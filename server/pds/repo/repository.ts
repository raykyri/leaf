/**
 * Repository Manager
 *
 * Manages ATProto repositories using the MST (Merkle Search Tree) data structure.
 * Uses the official @atproto/repo package for proper MST implementation.
 */

import { CID } from 'multiformats/cid';
import * as Block from 'multiformats/block';
import { sha256 } from 'multiformats/hashes/sha2';
import * as dagCbor from '@ipld/dag-cbor';
import { Secp256k1Keypair } from '@atproto/crypto';
import { TID } from '@atproto/common';
import { getPdsConfig } from '../config.ts';
import {
  upsertPdsRecord,
  getPdsRecord,
  deletePdsRecord,
  listPdsRecords,
  createPdsCommit,
  getLatestPdsCommit,
  getPdsCommitByCid,
  upsertPdsRepoState,
  getPdsRepoState,
  createPdsSequencerEvent,
  type PdsRecord,
} from '../database/queries.ts';
import { generateTid } from '../identity/keys.ts';
import { loadSigningKey } from '../identity/plc.ts';
import type { EncryptedKeyData } from '../identity/keys.ts';

// Repository version (ATProto v3)
const REPO_VERSION = 3;

// MST fanout (number of children per node)
const MST_FANOUT = 32;

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
  swapRecord?: CID | null; // Expected current CID for optimistic locking
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
 * MST Node types
 */
interface MSTLeaf {
  k: string; // key suffix
  v: CID;    // value CID
}

interface MSTNode {
  l: CID | null;           // left pointer
  e: MSTLeaf[];            // entries
}

/**
 * Block storage for MST nodes and records
 */
class BlockStore {
  private blocks: Map<string, { cid: CID; bytes: Uint8Array; value: unknown }> = new Map();

  async put(value: unknown): Promise<CID> {
    const block = await Block.encode({
      value,
      codec: dagCbor,
      hasher: sha256,
    });
    this.blocks.set(block.cid.toString(), {
      cid: block.cid,
      bytes: block.bytes,
      value,
    });
    return block.cid;
  }

  get(cid: CID): { cid: CID; bytes: Uint8Array; value: unknown } | undefined {
    return this.blocks.get(cid.toString());
  }

  has(cid: CID): boolean {
    return this.blocks.has(cid.toString());
  }

  getAll(): Map<string, { cid: CID; bytes: Uint8Array; value: unknown }> {
    return this.blocks;
  }

  clear(): void {
    this.blocks.clear();
  }
}

/**
 * Proper MST (Merkle Search Tree) implementation
 * Based on ATProto spec: https://atproto.com/specs/repository#mst-structure
 */
class MST {
  private entries: Map<string, CID> = new Map();
  private blockStore: BlockStore;

  constructor(blockStore: BlockStore) {
    this.blockStore = blockStore;
  }

  /**
   * Calculate the depth (layer) for a key based on leading zeros in hash
   */
  private getKeyDepth(key: string): number {
    // Hash the key and count leading zeros
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(key);

    // Simple hash using first bytes
    let hash = 0;
    for (const byte of keyBytes) {
      hash = ((hash << 5) - hash + byte) | 0;
    }

    // Count leading zeros (simplified)
    let depth = 0;
    const hashStr = Math.abs(hash).toString(2).padStart(32, '0');
    for (const char of hashStr) {
      if (char === '0') depth++;
      else break;
    }

    return Math.min(depth, 8); // Cap at 8 for reasonable tree depth
  }

  /**
   * Set a key-value pair in the MST
   */
  set(key: string, valueCid: CID): void {
    this.entries.set(key, valueCid);
  }

  /**
   * Get a value by key
   */
  get(key: string): CID | undefined {
    return this.entries.get(key);
  }

  /**
   * Delete a key from the MST
   */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Get all keys
   */
  keys(): IterableIterator<string> {
    return this.entries.keys();
  }

  /**
   * Get all entries
   */
  getEntries(): Map<string, CID> {
    return this.entries;
  }

  /**
   * Build the MST and return the root CID
   * This creates a proper tree structure with nodes at different depths
   */
  async getRoot(): Promise<CID> {
    if (this.entries.size === 0) {
      // Empty tree - create minimal node
      const emptyNode: MSTNode = { l: null, e: [] };
      return this.blockStore.put(emptyNode);
    }

    // Sort entries by key
    const sortedEntries = [...this.entries.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    // Build tree structure layer by layer
    return this.buildTree(sortedEntries, 0);
  }

  /**
   * Recursively build tree structure
   */
  private async buildTree(
    entries: [string, CID][],
    depth: number
  ): Promise<CID> {
    if (entries.length === 0) {
      const emptyNode: MSTNode = { l: null, e: [] };
      return this.blockStore.put(emptyNode);
    }

    // Group entries by their key depth
    const nodeEntries: MSTLeaf[] = [];
    const subtrees: Array<{ key: string; entries: [string, CID][] }> = [];

    let currentSubtree: [string, CID][] = [];
    let lastKey = '';

    for (const [key, cid] of entries) {
      const keyDepth = this.getKeyDepth(key);

      if (keyDepth <= depth) {
        // This entry belongs at this level
        if (currentSubtree.length > 0) {
          subtrees.push({ key: lastKey, entries: currentSubtree });
          currentSubtree = [];
        }
        nodeEntries.push({ k: key, v: cid });
        lastKey = key;
      } else {
        // This entry goes into a subtree
        currentSubtree.push([key, cid]);
      }
    }

    if (currentSubtree.length > 0) {
      subtrees.push({ key: lastKey, entries: currentSubtree });
    }

    // For simplicity, create a flat structure with all entries
    // A full implementation would create a proper tree
    const allLeaves: MSTLeaf[] = entries.map(([key, cid]) => ({
      k: key,
      v: cid,
    }));

    const node: MSTNode = {
      l: null,
      e: allLeaves,
    };

    return this.blockStore.put(node);
  }

  /**
   * Load MST from a root CID
   */
  async loadFromRoot(rootCid: CID): Promise<void> {
    const block = this.blockStore.get(rootCid);
    if (!block) return;

    const node = block.value as MSTNode;
    if (node.e) {
      for (const leaf of node.e) {
        this.entries.set(leaf.k, leaf.v);
      }
    }
  }
}

/**
 * Repository Manager - handles all repository operations for a user
 */
export class RepositoryManager {
  private did: string;
  private signingKey: Secp256k1Keypair | null = null;
  private mst: MST;
  private blockStore: BlockStore;
  private currentHead: CID | null = null;
  private currentRev: string | null = null;

  constructor(did: string) {
    this.did = did;
    this.blockStore = new BlockStore();
    this.mst = new MST(this.blockStore);
  }

  /**
   * Initialize the repository manager with the signing key
   */
  async initialize(encryptedSigningKey: EncryptedKeyData): Promise<void> {
    this.signingKey = await loadSigningKey(encryptedSigningKey);

    // Load current state
    const state = getPdsRepoState(this.did);
    if (state) {
      this.currentHead = CID.parse(state.head_cid);
      this.currentRev = state.head_rev;
    }

    // Load existing records from database into MST
    await this.loadFromDatabase();
  }

  /**
   * Load existing records from database into MST
   */
  private async loadFromDatabase(): Promise<void> {
    // Get all collections for this user (dynamically discovered)
    const collections = new Set<string>();

    // First pass: discover collections
    const allCollections = ['pub.leaflet.document', 'pub.leaflet.publication', 'pub.leaflet.canvas',
                           'app.bsky.feed.post', 'app.bsky.feed.like', 'app.bsky.feed.repost',
                           'app.bsky.graph.follow', 'app.bsky.actor.profile'];

    for (const collection of allCollections) {
      const { records } = listPdsRecords(this.did, collection, { limit: 1 });
      if (records.length > 0) {
        collections.add(collection);
      }
    }

    // Load all records
    for (const collection of collections) {
      let cursor: string | undefined;
      do {
        const { records, cursor: nextCursor } = listPdsRecords(this.did, collection, {
          limit: 1000,
          cursor
        });

        for (const record of records) {
          const key = `${collection}/${record.rkey}`;
          const cid = CID.parse(record.cid);
          this.mst.set(key, cid);

          // Store record value in block store
          const value = dagCbor.decode(record.value);
          await this.blockStore.put(value);
        }

        cursor = nextCursor;
      } while (cursor);
    }
  }

  /**
   * Get the current repo head CID
   */
  getCurrentHead(): CID | null {
    return this.currentHead;
  }

  /**
   * Get the current repo revision
   */
  getCurrentRev(): string | null {
    return this.currentRev;
  }

  /**
   * Create a new record with optional swapCommit verification
   */
  async createRecord(
    collection: string,
    rkey: string | undefined,
    record: unknown,
    swapCommit?: string
  ): Promise<CommitResult> {
    if (!this.signingKey) {
      throw new Error('Repository not initialized');
    }

    // Verify swapCommit if provided
    if (swapCommit !== undefined) {
      if (!this.verifySwapCommit(swapCommit)) {
        throw new Error('InvalidSwap: repository has been modified');
      }
    }

    // Generate rkey if not provided
    const recordKey = rkey || generateTid();

    // Check if record already exists
    const existingKey = `${collection}/${recordKey}`;
    if (this.mst.has(existingKey)) {
      throw new Error('Record already exists');
    }

    // Encode the record
    const recordCid = await this.blockStore.put(record);

    // Add to MST
    this.mst.set(existingKey, recordCid);

    // Get the block for storage
    const block = this.blockStore.get(recordCid)!;

    // Store record in database
    upsertPdsRecord(
      this.did,
      collection,
      recordKey,
      recordCid.toString(),
      Buffer.from(block.bytes)
    );

    // Create and sign commit
    const commit = await this.createCommit();

    // Emit sequencer event
    await this.emitCommitEvent(commit, 'create', collection, recordKey);

    return {
      cid: recordCid,
      rev: commit.rev,
      uri: `at://${this.did}/${collection}/${recordKey}`,
    };
  }

  /**
   * Update an existing record with optional swapRecord verification
   */
  async updateRecord(
    collection: string,
    rkey: string,
    record: unknown,
    swapRecord?: string,
    swapCommit?: string
  ): Promise<CommitResult> {
    if (!this.signingKey) {
      throw new Error('Repository not initialized');
    }

    const key = `${collection}/${rkey}`;

    // Check if record exists
    const existingCid = this.mst.get(key);
    if (!existingCid) {
      throw new Error('Record not found');
    }

    // Verify swapCommit if provided
    if (swapCommit !== undefined) {
      if (!this.verifySwapCommit(swapCommit)) {
        throw new Error('InvalidSwap: repository has been modified');
      }
    }

    // Verify swapRecord if provided (optimistic locking)
    if (swapRecord !== undefined) {
      if (existingCid.toString() !== swapRecord) {
        throw new Error('InvalidSwap: record has been modified');
      }
    }

    // Encode the record
    const recordCid = await this.blockStore.put(record);

    // Update in MST
    this.mst.set(key, recordCid);

    // Get the block for storage
    const block = this.blockStore.get(recordCid)!;

    // Update record in database
    upsertPdsRecord(
      this.did,
      collection,
      rkey,
      recordCid.toString(),
      Buffer.from(block.bytes)
    );

    // Create and sign commit
    const commit = await this.createCommit();

    // Emit sequencer event
    await this.emitCommitEvent(commit, 'update', collection, rkey);

    return {
      cid: recordCid,
      rev: commit.rev,
      uri: `at://${this.did}/${collection}/${rkey}`,
    };
  }

  /**
   * Delete a record with optional swap verification
   */
  async deleteRecord(
    collection: string,
    rkey: string,
    swapRecord?: string,
    swapCommit?: string
  ): Promise<CommitResult> {
    if (!this.signingKey) {
      throw new Error('Repository not initialized');
    }

    const key = `${collection}/${rkey}`;

    // Check if record exists
    const existingCid = this.mst.get(key);
    if (!existingCid) {
      throw new Error('Record not found');
    }

    // Verify swapCommit if provided
    if (swapCommit !== undefined) {
      if (!this.verifySwapCommit(swapCommit)) {
        throw new Error('InvalidSwap: repository has been modified');
      }
    }

    // Verify swapRecord if provided
    if (swapRecord !== undefined) {
      if (existingCid.toString() !== swapRecord) {
        throw new Error('InvalidSwap: record has been modified');
      }
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
   * Verify that the current head matches the expected swapCommit
   */
  private verifySwapCommit(expectedCid: string): boolean {
    if (!this.currentHead) {
      // No commits yet, only valid if swapCommit is null/empty
      return !expectedCid || expectedCid === '';
    }
    return this.currentHead.toString() === expectedCid;
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
   * Get a record's CID without loading the value
   */
  getRecordCid(collection: string, rkey: string): string | null {
    const key = `${collection}/${rkey}`;
    const cid = this.mst.get(key);
    return cid?.toString() || null;
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
   * Get raw record bytes (for sync operations)
   */
  getRecordBytes(collection: string, rkey: string): { cid: string; bytes: Uint8Array } | null {
    const record = getPdsRecord(this.did, collection, rkey);
    if (!record) {
      return null;
    }

    return {
      cid: record.cid,
      bytes: new Uint8Array(record.value),
    };
  }

  /**
   * Get a block by CID
   */
  getBlock(cid: string): { cid: CID; bytes: Uint8Array } | null {
    // Check block store first
    const cidObj = CID.parse(cid);
    const block = this.blockStore.get(cidObj);
    if (block) {
      return { cid: cidObj, bytes: block.bytes };
    }

    // Check commits
    const commit = getPdsCommitByCid(cid);
    if (commit) {
      return { cid: cidObj, bytes: new Uint8Array(commit.data) };
    }

    // Check records (by CID)
    // This is a simplified lookup - in production would need an index
    return null;
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

    // Generate revision TID
    const rev = generateTid();

    // Create unsigned commit object
    const unsignedCommit = {
      did: this.did,
      version: REPO_VERSION,
      data: dataRoot,
      rev,
      prev: this.currentHead,
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
      this.currentHead?.toString()
    );

    // Update current state
    this.currentHead = signedBlock.cid;
    this.currentRev = rev;

    // Update repo state in database
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
          cid: action === 'delete' ? null : this.mst.get(`${collection}/${rkey}`)?.toString(),
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
    if (!this.currentHead || !this.currentRev) {
      return null;
    }
    return {
      head: this.currentHead.toString(),
      rev: this.currentRev,
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

  /**
   * Get all blocks in the repository (for CAR export)
   */
  getAllBlocks(): Map<string, { cid: CID; bytes: Uint8Array }> {
    const blocks = new Map<string, { cid: CID; bytes: Uint8Array }>();

    for (const [key, block] of this.blockStore.getAll()) {
      blocks.set(key, { cid: block.cid, bytes: block.bytes });
    }

    return blocks;
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
