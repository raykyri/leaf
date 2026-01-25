/**
 * Block Storage
 * Handles storage and retrieval of DAG-CBOR blocks for repositories
 */

import { CID } from 'multiformats/cid';
import { getDatabase } from '../../database/index.ts';

export interface BlockStorage {
  /** Get a block by CID */
  get(cid: CID): Promise<Uint8Array | null>;
  /** Put a block */
  put(cid: CID, block: Uint8Array): Promise<void>;
  /** Check if a block exists */
  has(cid: CID): Promise<boolean>;
  /** Delete a block */
  delete(cid: CID): Promise<void>;
  /** Get multiple blocks */
  getMany(cids: CID[]): Promise<Map<string, Uint8Array>>;
  /** Put multiple blocks */
  putMany(blocks: Map<CID, Uint8Array>): Promise<void>;
}

/**
 * SQLite-backed block storage for a single repository
 */
export class SqliteBlockStorage implements BlockStorage {
  private did: string;

  constructor(did: string) {
    this.did = did;
  }

  async get(cid: CID): Promise<Uint8Array | null> {
    const db = getDatabase();
    const cidStr = cid.toString();

    const row = db
      .prepare('SELECT content FROM repo_blocks WHERE cid = ? AND repo_did = ?')
      .get(cidStr, this.did) as { content: Buffer } | undefined;

    return row ? new Uint8Array(row.content) : null;
  }

  async put(cid: CID, block: Uint8Array): Promise<void> {
    const db = getDatabase();
    const cidStr = cid.toString();

    db.prepare(
      `INSERT INTO repo_blocks (cid, repo_did, content) VALUES (?, ?, ?)
       ON CONFLICT(cid, repo_did) DO UPDATE SET content = excluded.content`
    ).run(cidStr, this.did, Buffer.from(block));
  }

  async has(cid: CID): Promise<boolean> {
    const db = getDatabase();
    const cidStr = cid.toString();

    const row = db
      .prepare('SELECT 1 FROM repo_blocks WHERE cid = ? AND repo_did = ?')
      .get(cidStr, this.did);

    return !!row;
  }

  async delete(cid: CID): Promise<void> {
    const db = getDatabase();
    const cidStr = cid.toString();

    db.prepare('DELETE FROM repo_blocks WHERE cid = ? AND repo_did = ?').run(cidStr, this.did);
  }

  async getMany(cids: CID[]): Promise<Map<string, Uint8Array>> {
    const db = getDatabase();
    const result = new Map<string, Uint8Array>();

    // Batch fetch for efficiency
    const placeholders = cids.map(() => '?').join(',');
    const cidStrs = cids.map((c) => c.toString());

    if (cidStrs.length === 0) {
      return result;
    }

    const rows = db
      .prepare(
        `SELECT cid, content FROM repo_blocks WHERE cid IN (${placeholders}) AND repo_did = ?`
      )
      .all(...cidStrs, this.did) as Array<{ cid: string; content: Buffer }>;

    for (const row of rows) {
      result.set(row.cid, new Uint8Array(row.content));
    }

    return result;
  }

  async putMany(blocks: Map<CID, Uint8Array>): Promise<void> {
    const db = getDatabase();

    const stmt = db.prepare(
      `INSERT INTO repo_blocks (cid, repo_did, content) VALUES (?, ?, ?)
       ON CONFLICT(cid, repo_did) DO UPDATE SET content = excluded.content`
    );

    const insertMany = db.transaction((blocks: Map<CID, Uint8Array>) => {
      for (const [cid, block] of blocks) {
        stmt.run(cid.toString(), this.did, Buffer.from(block));
      }
    });

    insertMany(blocks);
  }

  /**
   * Get all block CIDs for this repository
   */
  async listCids(): Promise<CID[]> {
    const db = getDatabase();

    const rows = db
      .prepare('SELECT cid FROM repo_blocks WHERE repo_did = ?')
      .all(this.did) as Array<{ cid: string }>;

    return rows.map((row) => CID.parse(row.cid));
  }

  /**
   * Get total size of all blocks in bytes
   */
  async getTotalSize(): Promise<number> {
    const db = getDatabase();

    const row = db
      .prepare('SELECT SUM(LENGTH(content)) as total FROM repo_blocks WHERE repo_did = ?')
      .get(this.did) as { total: number | null };

    return row?.total || 0;
  }

  /**
   * Delete all blocks for this repository
   */
  async clear(): Promise<void> {
    const db = getDatabase();
    db.prepare('DELETE FROM repo_blocks WHERE repo_did = ?').run(this.did);
  }
}

/**
 * Create block storage instance for a DID
 */
export function createBlockStorage(did: string): BlockStorage {
  return new SqliteBlockStorage(did);
}
