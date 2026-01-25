/**
 * Repository Manager
 *
 * Manages ATProto repositories using the MST (Merkle Search Tree) data structure.
 * Each user has a repository containing all their records.
 */

import { CID } from 'multiformats/cid';
import * as Block from 'multiformats/block';
import { sha256 } from 'multiformats/hashes/sha2';
import * as dagCbor from '@ipld/dag-cbor';
import { Secp256k1Keypair } from '@atproto/crypto';
import { getPdsConfig } from '../config.ts';
import {
  upsertPdsRecord,
  getPdsRecord,
  deletePdsRecord,
  listPdsRecords,
  createPdsCommit,
  getLatestPdsCommit,
  upsertPdsRepoState,
  getPdsRepoState,
  createPdsSequencerEvent,
  type PdsRecord,
} from '../database/queries.ts';
import { generateTid } from '../identity/keys.ts';
import { loadSigningKey } from '../identity/plc.ts';
import type { EncryptedKeyData } from '../identity/keys.ts';

// Repository version
const REPO_VERSION = 3;

export interface RepoCommit {
  did: string;
  version: number;
  data: CID;
  rev: string;
  prev: CID | null;
  sig: Uint8Array;
}

export interface WriteOperation {
  action: 'create' | 'update' | 'delete';
  collection: string;
  rkey: string;
  record?: unknown;
}

export interface CommitResult {
  cid: CID;
  rev: string;
  uri: string;
}

export interface RecordResult {
  uri: string;
  cid: string;
  value: unknown;
}

/**
 * Simple MST (Merkle Search Tree) implementation
 * This is a simplified version - a full implementation would use @atproto/repo
 */
class SimpleMST {
  private entries: Map<string, { cid: CID; value: unknown }> = new Map();

  constructor(entries?: Map<string, { cid: CID; value: unknown }>) {
    if (entries) {
      this.entries = entries;
    }
  }

  set(key: string, cid: CID, value: unknown): void {
    this.entries.set(key, { cid, value });
  }

  get(key: string): { cid: CID; value: unknown } | undefined {
    return this.entries.get(key);
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  keys(): IterableIterator<string> {
    return this.entries.keys();
  }

  async getRoot(): Promise<CID> {
    // Create a deterministic representation of the tree
    const sortedEntries = [...this.entries.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    const treeData = {
      entries: sortedEntries.map(([key, { cid }]) => ({
        k: key,
        v: cid,
      })),
    };

    const block = await Block.encode({
      value: treeData,
      codec: dagCbor,
      hasher: sha256,
    });

    return block.cid;
  }

  getEntries(): Map<string, { cid: CID; value: unknown }> {
    return this.entries;
  }
}

/**
 * Repository Manager - handles all repository operations for a user
 */
export class RepositoryManager {
  private did: string;
  private signingKey: Secp256k1Keypair | null = null;
  private mst: SimpleMST;

  constructor(did: string) {
    this.did = did;
    this.mst = new SimpleMST();
  }

  /**
   * Initialize the repository manager with the signing key
   */
  async initialize(encryptedSigningKey: EncryptedKeyData): Promise<void> {
    this.signingKey = await loadSigningKey(encryptedSigningKey);

    // Load existing records from database into MST
    await this.loadFromDatabase();
  }

  /**
   * Load existing records from database into MST
   */
  private async loadFromDatabase(): Promise<void> {
    // Get all collections for this user
    const collections = ['pub.leaflet.document', 'pub.leaflet.publication', 'pub.leaflet.canvas'];

    for (const collection of collections) {
      const { records } = listPdsRecords(this.did, collection, { limit: 10000 });

      for (const record of records) {
        const key = `${collection}/${record.rkey}`;
        const value = dagCbor.decode(record.value);
        const cid = CID.parse(record.cid);
        this.mst.set(key, cid, value);
      }
    }
  }

  /**
   * Create a new record
   */
  async createRecord(
    collection: string,
    rkey: string | undefined,
    record: unknown
  ): Promise<CommitResult> {
    if (!this.signingKey) {
      throw new Error('Repository not initialized');
    }

    // Generate rkey if not provided
    const recordKey = rkey || generateTid();

    // Check if record already exists
    const existingKey = `${collection}/${recordKey}`;
    if (this.mst.has(existingKey)) {
      throw new Error('Record already exists');
    }

    // Encode the record
    const block = await Block.encode({
      value: record,
      codec: dagCbor,
      hasher: sha256,
    });

    // Add to MST
    this.mst.set(existingKey, block.cid, record);

    // Store record in database
    upsertPdsRecord(
      this.did,
      collection,
      recordKey,
      block.cid.toString(),
      Buffer.from(block.bytes)
    );

    // Create and sign commit
    const commit = await this.createCommit();

    // Emit sequencer event
    await this.emitCommitEvent(commit, 'create', collection, recordKey);

    return {
      cid: block.cid,
      rev: commit.rev,
      uri: `at://${this.did}/${collection}/${recordKey}`,
    };
  }

  /**
   * Update an existing record
   */
  async updateRecord(
    collection: string,
    rkey: string,
    record: unknown
  ): Promise<CommitResult> {
    if (!this.signingKey) {
      throw new Error('Repository not initialized');
    }

    const key = `${collection}/${rkey}`;

    // Check if record exists
    if (!this.mst.has(key)) {
      throw new Error('Record not found');
    }

    // Encode the record
    const block = await Block.encode({
      value: record,
      codec: dagCbor,
      hasher: sha256,
    });

    // Update in MST
    this.mst.set(key, block.cid, record);

    // Update record in database
    upsertPdsRecord(
      this.did,
      collection,
      rkey,
      block.cid.toString(),
      Buffer.from(block.bytes)
    );

    // Create and sign commit
    const commit = await this.createCommit();

    // Emit sequencer event
    await this.emitCommitEvent(commit, 'update', collection, rkey);

    return {
      cid: block.cid,
      rev: commit.rev,
      uri: `at://${this.did}/${collection}/${rkey}`,
    };
  }

  /**
   * Delete a record
   */
  async deleteRecord(collection: string, rkey: string): Promise<CommitResult> {
    if (!this.signingKey) {
      throw new Error('Repository not initialized');
    }

    const key = `${collection}/${rkey}`;

    // Check if record exists
    if (!this.mst.has(key)) {
      throw new Error('Record not found');
    }

    // Remove from MST
    this.mst.delete(key);

    // Delete from database
    deletePdsRecord(this.did, collection, rkey);

    // Create and sign commit
    const commit = await this.createCommit();

    // Emit sequencer event
    await this.emitCommitEvent(commit, 'delete', collection, rkey);

    return {
      cid: commit.cid,
      rev: commit.rev,
      uri: `at://${this.did}/${collection}/${rkey}`,
    };
  }

  /**
   * Get a record
   */
  getRecord(collection: string, rkey: string): RecordResult | null {
    const record = getPdsRecord(this.did, collection, rkey);
    if (!record) {
      return null;
    }

    const value = dagCbor.decode(record.value);

    return {
      uri: `at://${this.did}/${collection}/${rkey}`,
      cid: record.cid,
      value,
    };
  }

  /**
   * List records in a collection
   */
  listRecords(
    collection: string,
    options?: { limit?: number; cursor?: string; reverse?: boolean }
  ): { records: RecordResult[]; cursor?: string } {
    const result = listPdsRecords(this.did, collection, options);

    const records = result.records.map((record: PdsRecord) => ({
      uri: `at://${this.did}/${collection}/${record.rkey}`,
      cid: record.cid,
      value: dagCbor.decode(record.value),
    }));

    return {
      records,
      cursor: result.cursor,
    };
  }

  /**
   * Create and sign a new commit
   */
  private async createCommit(): Promise<{ cid: CID; rev: string }> {
    if (!this.signingKey) {
      throw new Error('Repository not initialized');
    }

    // Get the MST root
    const dataRoot = await this.mst.getRoot();

    // Get previous commit
    const prevCommit = getLatestPdsCommit(this.did);
    const prevCid = prevCommit ? CID.parse(prevCommit.cid) : null;

    // Generate revision TID
    const rev = generateTid();

    // Create unsigned commit object
    const unsignedCommit = {
      did: this.did,
      version: REPO_VERSION,
      data: dataRoot,
      rev,
      prev: prevCid,
    };

    // Encode for signing
    const unsignedBlock = await Block.encode({
      value: unsignedCommit,
      codec: dagCbor,
      hasher: sha256,
    });

    // Sign the commit
    const sig = await this.signingKey.sign(unsignedBlock.bytes);

    // Create signed commit
    const signedCommit = {
      ...unsignedCommit,
      sig,
    };

    // Encode signed commit
    const signedBlock = await Block.encode({
      value: signedCommit,
      codec: dagCbor,
      hasher: sha256,
    });

    // Store commit in database
    createPdsCommit(
      this.did,
      signedBlock.cid.toString(),
      rev,
      dataRoot.toString(),
      Buffer.from(signedBlock.bytes),
      prevCid?.toString()
    );

    // Update repo state
    upsertPdsRepoState(this.did, signedBlock.cid.toString(), rev);

    return {
      cid: signedBlock.cid,
      rev,
    };
  }

  /**
   * Emit a commit event to the sequencer
   */
  private async emitCommitEvent(
    commit: { cid: CID; rev: string },
    action: 'create' | 'update' | 'delete',
    collection: string,
    rkey: string
  ): Promise<void> {
    const eventData = {
      seq: 0, // Will be set by the sequencer
      did: this.did,
      time: new Date().toISOString(),
      commit: {
        cid: commit.cid.toString(),
        rev: commit.rev,
      },
      ops: [
        {
          action,
          path: `${collection}/${rkey}`,
          cid: action === 'delete' ? null : this.mst.get(`${collection}/${rkey}`)?.cid.toString(),
        },
      ],
    };

    const eventBuffer = Buffer.from(JSON.stringify(eventData));
    createPdsSequencerEvent(this.did, 'commit', eventBuffer, commit.cid.toString());
  }

  /**
   * Get the current repo state
   */
  getRepoState(): { head: string; rev: string } | null {
    const state = getPdsRepoState(this.did);
    if (!state) {
      return null;
    }
    return {
      head: state.head_cid,
      rev: state.head_rev,
    };
  }

  /**
   * Describe the repository
   */
  describe(): {
    handle: string;
    did: string;
    collections: string[];
    handleIsCorrect: boolean;
  } {
    const collections = new Set<string>();
    for (const key of this.mst.keys()) {
      const [collection] = key.split('/');
      collections.add(collection);
    }

    return {
      handle: '', // Will be filled by caller
      did: this.did,
      collections: [...collections],
      handleIsCorrect: true,
    };
  }
}

// Cache of repository managers
const repoCache = new Map<string, RepositoryManager>();

/**
 * Get or create a repository manager for a DID
 */
export async function getRepository(
  did: string,
  encryptedSigningKey?: EncryptedKeyData
): Promise<RepositoryManager> {
  let repo = repoCache.get(did);

  if (!repo) {
    repo = new RepositoryManager(did);
    if (encryptedSigningKey) {
      await repo.initialize(encryptedSigningKey);
    }
    repoCache.set(did, repo);
  }

  return repo;
}

/**
 * Clear the repository cache (for testing)
 */
export function clearRepositoryCache(): void {
  repoCache.clear();
}
