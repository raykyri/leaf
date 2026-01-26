/**
 * MST Types
 * Type definitions for the Merkle Search Tree implementation
 */

import { CID } from 'multiformats/cid';

/**
 * MST Node entry as stored in CBOR
 * Uses prefix compression for keys
 */
export interface NodeEntry {
  /** Prefix length - bytes shared with previous entry's key */
  p: number;
  /** Key suffix - remaining key bytes after prefix */
  k: Uint8Array;
  /** Value - CID link to the record */
  v: CID;
  /** Tree - nullable CID link to right subtree */
  t: CID | null;
}

/**
 * MST Node as stored in CBOR
 */
export interface NodeData {
  /** Left subtree - nullable CID link to subtree with keys before first entry */
  l: CID | null;
  /** Entries - array of node entries */
  e: NodeEntry[];
}

/**
 * A leaf entry in the MST (key-value pair)
 */
export interface Leaf {
  type: 'leaf';
  key: string;
  value: CID;
}

/**
 * A tree pointer in the MST
 */
export interface TreePointer {
  type: 'tree';
  pointer: CID | null;
}

/**
 * An entry in the working MST structure (either leaf or tree pointer)
 */
export type Entry = Leaf | TreePointer;

/**
 * Block storage interface for persisting MST nodes
 */
export interface BlockStore {
  /** Get a block by CID */
  get(cid: CID): Promise<Uint8Array | null>;
  /** Store a block and return its CID */
  put(cid: CID, bytes: Uint8Array): Promise<void>;
  /** Check if a block exists */
  has(cid: CID): Promise<boolean>;
}

/**
 * In-memory block store for testing
 */
export class MemoryBlockStore implements BlockStore {
  private blocks = new Map<string, Uint8Array>();

  async get(cid: CID): Promise<Uint8Array | null> {
    return this.blocks.get(cid.toString()) || null;
  }

  async put(cid: CID, bytes: Uint8Array): Promise<void> {
    this.blocks.set(cid.toString(), bytes);
  }

  async has(cid: CID): Promise<boolean> {
    return this.blocks.has(cid.toString());
  }

  /** Get all stored CIDs */
  getCids(): CID[] {
    return [...this.blocks.keys()].map(s => CID.parse(s));
  }

  /** Get the number of stored blocks */
  get size(): number {
    return this.blocks.size;
  }

  /** Clear all blocks */
  clear(): void {
    this.blocks.clear();
  }
}

/**
 * Result of a diff operation between two MST states
 */
export interface DiffResult {
  /** Keys that were added */
  adds: Map<string, CID>;
  /** Keys that were updated (old value, new value) */
  updates: Map<string, { old: CID; new: CID }>;
  /** Keys that were deleted */
  deletes: Map<string, CID>;
  /** New CIDs that need to be stored */
  newCids: Set<string>;
}

/**
 * Options for MST operations
 */
export interface MSTOptions {
  /** Block store for persistence */
  blockStore?: BlockStore;
  /** Fanout (default 4, derived from 2-bit zero counting) */
  fanout?: number;
}

/**
 * Result of serializing an MST node
 */
export interface SerializeResult {
  cid: CID;
  bytes: Uint8Array;
}
