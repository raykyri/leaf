/**
 * Repository Layer
 * Handles ATProto repository operations including MST, commits, and record management
 */

import { CID } from 'multiformats/cid';
// @ts-ignore - @ipld/dag-cbor types not resolving correctly due to exports
import * as cbor from '@ipld/dag-cbor';
import { sha256 } from 'multiformats/hashes/sha2';
import { getDatabase } from '../../database/index.ts';
import { createBlockStorage, type BlockStorage } from './storage.ts';
import { type KeyPair, sign, getKeypairInstance } from '../crypto/keys.ts';
import { emitCommitEvent } from '../firehose/index.ts';

// TID generation for record keys and revisions
const TID_CHARS = '234567abcdefghijklmnopqrstuvwxyz';
let lastTimestamp = 0;
let clockId = 0;

/**
 * Generate a TID (timestamp-based identifier)
 */
export function generateTid(): string {
  let timestamp = Date.now() * 1000; // microseconds

  // Ensure monotonically increasing
  if (timestamp <= lastTimestamp) {
    timestamp = lastTimestamp + 1;
  }
  lastTimestamp = timestamp;

  // Increment clock ID for uniqueness within same microsecond
  clockId = (clockId + 1) % 1024;

  // Encode timestamp (53 bits) + clock ID (10 bits) in base32
  const value = BigInt(timestamp) * 1024n + BigInt(clockId);
  let result = '';

  let v = value;
  for (let i = 0; i < 13; i++) {
    result = TID_CHARS[Number(v % 32n)] + result;
    v = v / 32n;
  }

  return result;
}

export interface RepoState {
  did: string;
  headCid: CID;
  rev: string;
  rootCid: CID;
}

export interface CommitResult {
  cid: CID;
  rev: string;
}

export interface WriteOp {
  action: 'create' | 'update' | 'delete';
  collection: string;
  rkey: string;
  record?: unknown;
}

export interface RecordPath {
  collection: string;
  rkey: string;
}

/**
 * Commit data structure (ATProto v3)
 */
interface Commit {
  did: string;
  version: 3;
  data: CID; // MST root
  rev: string;
  prev: CID | null;
  sig: Uint8Array;
}

/**
 * MST Node structure
 */
interface MSTNode {
  l: CID | null; // left subtree
  e: MSTEntry[]; // entries
}

interface MSTEntry {
  p: number; // prefix length (shared with previous)
  k: Uint8Array; // key suffix
  v: CID; // value (record CID)
  t: CID | null; // right subtree
}

/**
 * Repository manager for a single user
 */
export class Repository {
  private storage: BlockStorage;
  private did: string;

  constructor(did: string) {
    this.did = did;
    this.storage = createBlockStorage(did);
  }

  /**
   * Get current repository state
   */
  async getState(): Promise<RepoState | null> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM repo_state WHERE did = ?').get(this.did) as
      | { head_cid: string; rev: string; root_cid: string }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      did: this.did,
      headCid: CID.parse(row.head_cid),
      rev: row.rev,
      rootCid: CID.parse(row.root_cid),
    };
  }

  /**
   * Create a record in the repository
   */
  async createRecord(
    collection: string,
    rkey: string,
    record: unknown,
    signingKey: KeyPair
  ): Promise<CommitResult> {
    return this.applyWrites([{ action: 'create', collection, rkey, record }], signingKey);
  }

  /**
   * Update a record in the repository
   */
  async updateRecord(
    collection: string,
    rkey: string,
    record: unknown,
    signingKey: KeyPair
  ): Promise<CommitResult> {
    return this.applyWrites([{ action: 'update', collection, rkey, record }], signingKey);
  }

  /**
   * Delete a record from the repository
   */
  async deleteRecord(collection: string, rkey: string, signingKey: KeyPair): Promise<CommitResult> {
    return this.applyWrites([{ action: 'delete', collection, rkey }], signingKey);
  }

  /**
   * Apply multiple write operations atomically
   */
  async applyWrites(writes: WriteOp[], signingKey: KeyPair): Promise<CommitResult> {
    const db = getDatabase();
    const state = await this.getState();

    // Get current records index
    const records = new Map<string, { cid: CID; record: unknown }>();

    if (state) {
      const rows = db
        .prepare('SELECT collection, rkey, cid, record_json FROM repo_records WHERE repo_did = ?')
        .all(this.did) as Array<{
        collection: string;
        rkey: string;
        cid: string;
        record_json: string;
      }>;

      for (const row of rows) {
        const key = `${row.collection}/${row.rkey}`;
        records.set(key, {
          cid: CID.parse(row.cid),
          record: JSON.parse(row.record_json),
        });
      }
    }

    // Apply writes to records map
    const ops: Array<{ action: string; path: string; cid: CID | null }> = [];
    const newBlocks = new Map<CID, Uint8Array>();

    for (const write of writes) {
      const key = `${write.collection}/${write.rkey}`;

      if (write.action === 'create' || write.action === 'update') {
        if (!write.record) {
          throw new Error(`Record required for ${write.action} operation`);
        }

        // Encode record as DAG-CBOR
        const recordBytes = cbor.encode(write.record);
        const recordHash = await sha256.digest(recordBytes);
        const recordCid = CID.createV1(cbor.code, recordHash);

        // Store record block
        newBlocks.set(recordCid, recordBytes);
        records.set(key, { cid: recordCid, record: write.record });

        ops.push({ action: write.action, path: key, cid: recordCid });
      } else if (write.action === 'delete') {
        records.delete(key);
        ops.push({ action: 'delete', path: key, cid: null });
      }
    }

    // Build MST from records
    const { rootCid, mstBlocks } = await this.buildMST(records);
    for (const [cid, block] of mstBlocks) {
      newBlocks.set(cid, block);
    }

    // Create commit
    const rev = generateTid();
    const commit: Omit<Commit, 'sig'> = {
      did: this.did,
      version: 3,
      data: rootCid,
      rev,
      prev: state?.headCid || null,
    };

    // Sign commit
    const commitBytes = cbor.encode(commit);
    const signature = await sign(signingKey, commitBytes);

    const signedCommit: Commit = {
      ...commit,
      sig: signature,
    };

    const signedCommitBytes = cbor.encode(signedCommit);
    const commitHash = await sha256.digest(signedCommitBytes);
    const commitCid = CID.createV1(cbor.code, commitHash);

    newBlocks.set(commitCid, signedCommitBytes);

    // Store all blocks
    await this.storage.putMany(newBlocks);

    // Update database state
    db.prepare(
      `INSERT INTO repo_state (did, head_cid, rev, root_cid)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(did) DO UPDATE SET
         head_cid = excluded.head_cid,
         rev = excluded.rev,
         root_cid = excluded.root_cid,
         updated_at = CURRENT_TIMESTAMP`
    ).run(this.did, commitCid.toString(), rev, rootCid.toString());

    // Update records index
    const deleteStmt = db.prepare(
      'DELETE FROM repo_records WHERE repo_did = ? AND collection = ? AND rkey = ?'
    );
    const upsertStmt = db.prepare(
      `INSERT INTO repo_records (repo_did, collection, rkey, cid, record_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(repo_did, collection, rkey) DO UPDATE SET
         cid = excluded.cid,
         record_json = excluded.record_json,
         indexed_at = CURRENT_TIMESTAMP`
    );

    const updateRecords = db.transaction(() => {
      for (const write of writes) {
        if (write.action === 'delete') {
          deleteStmt.run(this.did, write.collection, write.rkey);
        } else {
          const recordInfo = records.get(`${write.collection}/${write.rkey}`);
          if (recordInfo) {
            upsertStmt.run(
              this.did,
              write.collection,
              write.rkey,
              recordInfo.cid.toString(),
              JSON.stringify(recordInfo.record)
            );
          }
        }
      }
    });

    updateRecords();

    // Emit firehose event
    await emitCommitEvent(this.did, commitCid, rev, state?.rev || null, ops, newBlocks);

    return { cid: commitCid, rev };
  }

  /**
   * Build MST from records
   * This is a simplified implementation - a full implementation would build a proper
   * balanced Merkle Search Tree
   */
  private async buildMST(
    records: Map<string, { cid: CID; record: unknown }>
  ): Promise<{ rootCid: CID; mstBlocks: Map<CID, Uint8Array> }> {
    const mstBlocks = new Map<CID, Uint8Array>();

    // Sort keys for deterministic ordering
    const sortedKeys = [...records.keys()].sort();

    // Build a simple single-node MST for now
    // A full implementation would create a balanced tree based on key hashes
    const entries: MSTEntry[] = [];
    let prevKey = '';

    for (const key of sortedKeys) {
      const recordInfo = records.get(key)!;
      const keyBytes = new TextEncoder().encode(key);

      // Calculate prefix length (shared with previous key)
      let prefixLen = 0;
      const prevKeyBytes = new TextEncoder().encode(prevKey);
      while (prefixLen < prevKeyBytes.length && prefixLen < keyBytes.length) {
        if (prevKeyBytes[prefixLen] !== keyBytes[prefixLen]) break;
        prefixLen++;
      }

      entries.push({
        p: prefixLen,
        k: keyBytes.slice(prefixLen),
        v: recordInfo.cid,
        t: null,
      });

      prevKey = key;
    }

    const rootNode: MSTNode = {
      l: null,
      e: entries,
    };

    // Encode MST node
    const nodeBytes = cbor.encode(rootNode);
    const nodeHash = await sha256.digest(nodeBytes);
    const rootCid = CID.createV1(cbor.code, nodeHash);

    mstBlocks.set(rootCid, nodeBytes);

    return { rootCid, mstBlocks };
  }

  /**
   * Get a record by collection and rkey
   */
  async getRecord(collection: string, rkey: string): Promise<unknown | null> {
    const db = getDatabase();

    const row = db
      .prepare('SELECT record_json FROM repo_records WHERE repo_did = ? AND collection = ? AND rkey = ?')
      .get(this.did, collection, rkey) as { record_json: string } | undefined;

    return row ? JSON.parse(row.record_json) : null;
  }

  /**
   * List records in a collection
   */
  async listRecords(
    collection: string,
    options: {
      limit?: number;
      cursor?: string;
      reverse?: boolean;
    } = {}
  ): Promise<{ records: Array<{ uri: string; cid: string; value: unknown }>; cursor?: string }> {
    const db = getDatabase();
    const limit = Math.min(options.limit || 50, 100);
    const reverse = options.reverse || false;

    let query = `
      SELECT rkey, cid, record_json FROM repo_records
      WHERE repo_did = ? AND collection = ?
    `;

    const params: (string | number)[] = [this.did, collection];

    if (options.cursor) {
      query += reverse ? ' AND rkey < ?' : ' AND rkey > ?';
      params.push(options.cursor);
    }

    query += ` ORDER BY rkey ${reverse ? 'DESC' : 'ASC'} LIMIT ?`;
    params.push(limit + 1); // Fetch one extra to check for more

    const rows = db.prepare(query).all(...params) as Array<{
      rkey: string;
      cid: string;
      record_json: string;
    }>;

    const hasMore = rows.length > limit;
    const results = rows.slice(0, limit);

    const records = results.map((row) => ({
      uri: `at://${this.did}/${collection}/${row.rkey}`,
      cid: row.cid,
      value: JSON.parse(row.record_json),
    }));

    return {
      records,
      cursor: hasMore ? results[results.length - 1]?.rkey : undefined,
    };
  }

  /**
   * Get repository as CAR file (for sync)
   */
  async exportAsCAR(): Promise<Uint8Array> {
    const { CarWriter } = await import('@ipld/car');

    const state = await this.getState();
    if (!state) {
      throw new Error('Repository not initialized');
    }

    // Get all blocks
    const cids = await (this.storage as any).listCids();
    const blocks = await this.storage.getMany(cids);

    // Create CAR
    const { writer, out } = CarWriter.create([state.headCid]);

    // Collect chunks
    const chunks: Uint8Array[] = [];
    const reader = (async () => {
      for await (const chunk of out) {
        chunks.push(chunk);
      }
    })();

    // Write blocks
    for (const [cidStr, block] of blocks) {
      await writer.put({ cid: CID.parse(cidStr), bytes: block });
    }
    await writer.close();

    await reader;

    // Concatenate chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }
}

/**
 * Initialize a new repository for a user
 */
export async function initializeRepository(did: string, signingKey: KeyPair): Promise<RepoState> {
  const repo = new Repository(did);

  // Check if already initialized
  const existing = await repo.getState();
  if (existing) {
    return existing;
  }

  // Create empty MST
  const emptyNode: MSTNode = { l: null, e: [] };
  const nodeBytes = cbor.encode(emptyNode);
  const nodeHash = await sha256.digest(nodeBytes);
  const rootCid = CID.createV1(cbor.code, nodeHash);

  // Create initial commit
  const rev = generateTid();
  const commit: Omit<Commit, 'sig'> = {
    did,
    version: 3,
    data: rootCid,
    rev,
    prev: null,
  };

  const commitBytes = cbor.encode(commit);
  const signature = await sign(signingKey, commitBytes);

  const signedCommit: Commit = {
    ...commit,
    sig: signature,
  };

  const signedCommitBytes = cbor.encode(signedCommit);
  const commitHash = await sha256.digest(signedCommitBytes);
  const commitCid = CID.createV1(cbor.code, commitHash);

  // Store blocks
  const storage = createBlockStorage(did);
  await storage.put(rootCid, nodeBytes);
  await storage.put(commitCid, signedCommitBytes);

  // Store state
  const db = getDatabase();
  db.prepare(
    `INSERT INTO repo_state (did, head_cid, rev, root_cid)
     VALUES (?, ?, ?, ?)`
  ).run(did, commitCid.toString(), rev, rootCid.toString());

  return {
    did,
    headCid: commitCid,
    rev,
    rootCid,
  };
}

/**
 * Get repository instance for a DID
 */
export function getRepository(did: string): Repository {
  return new Repository(did);
}

/**
 * Check if a repository exists
 */
export function repositoryExists(did: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 FROM repo_state WHERE did = ?').get(did);
  return !!row;
}
