/**
 * Merkle Search Tree (MST) Implementation
 *
 * This implements the ATProto MST specification for storing key-value mappings
 * where keys are collection/rkey paths and values are CIDs pointing to records.
 *
 * The tree structure is determined by the SHA-256 hash of each key:
 * - Count leading zero bits in the hash
 * - Divide by 2, rounding down
 * - This gives the "layer" or depth of the key
 *
 * Keys with more leading zeros go in higher layers (closer to root).
 * This creates a probabilistically balanced tree with fanout ~4.
 */

import { CID } from 'multiformats/cid';
import {
  type NodeData,
  type NodeEntry,
  type Leaf,
  type TreePointer,
  type Entry,
  type BlockStore,
  type DiffResult,
  type SerializeResult,
  MemoryBlockStore,
} from './types.ts';
import {
  layerForKey,
  compareKeys,
  commonPrefixLength,
  cidForData,
  decodeCbor,
  encodeCbor,
  validateKey,
  ensureCID,
} from './util.ts';

/**
 * MST Node class
 * Represents a node in the Merkle Search Tree
 */
export class MSTNode {
  /** Entries in this node (leaves and tree pointers interleaved) */
  private nodeEntries: Entry[];

  /** Pointer to this node (computed lazily) */
  private pointer: CID | null = null;

  /** Whether the pointer needs recomputation */
  private outdated = true;

  /** The layer/depth this node represents */
  private layer: number | null;

  /** Block store for persistence */
  private blockStore: BlockStore;

  constructor(
    blockStore: BlockStore,
    entries: Entry[] = [],
    layer: number | null = null,
    pointer: CID | null = null
  ) {
    this.blockStore = blockStore;
    this.nodeEntries = entries;
    this.layer = layer;
    this.pointer = pointer;
    this.outdated = pointer === null;
  }

  /**
   * Create an empty MST
   */
  static create(blockStore?: BlockStore): MSTNode {
    return new MSTNode(blockStore || new MemoryBlockStore(), [], null);
  }

  /**
   * Load an MST from a CID
   */
  static async load(blockStore: BlockStore, cid: CID): Promise<MSTNode> {
    const bytes = await blockStore.get(cid);
    if (!bytes) {
      throw new Error(`Block not found: ${cid}`);
    }

    const data = decodeCbor<NodeData>(bytes);
    const entries = await MSTNode.deserializeEntries(blockStore, data);

    const node = new MSTNode(blockStore, entries, null, cid);
    node.outdated = false;
    return node;
  }

  /**
   * Deserialize node entries from CBOR format
   */
  private static async deserializeEntries(
    blockStore: BlockStore,
    data: NodeData
  ): Promise<Entry[]> {
    const entries: Entry[] = [];
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Add left tree pointer if present
    if (data.l !== null) {
      entries.push({ type: 'tree', pointer: ensureCID(data.l) });
    }

    // Reconstruct keys from prefix-compressed entries
    let prevKey = '';
    for (const entry of data.e) {
      // Reconstruct full key from prefix + suffix
      const prefixBytes = encoder.encode(prevKey).slice(0, entry.p);
      const fullKeyBytes = new Uint8Array(prefixBytes.length + entry.k.length);
      fullKeyBytes.set(prefixBytes);
      fullKeyBytes.set(entry.k, prefixBytes.length);
      const key = decoder.decode(fullKeyBytes);

      // Add the leaf entry
      entries.push({
        type: 'leaf',
        key,
        value: ensureCID(entry.v),
      });

      // Add right subtree if present
      if (entry.t !== null) {
        entries.push({ type: 'tree', pointer: ensureCID(entry.t) });
      }

      prevKey = key;
    }

    return entries;
  }

  /**
   * Serialize this node to CBOR format
   */
  async serialize(): Promise<SerializeResult> {
    const encoder = new TextEncoder();

    // Build CBOR structure
    const nodeData: NodeData = {
      l: null,
      e: [],
    };

    // Check for left tree pointer
    const firstEntry = this.nodeEntries[0];
    if (firstEntry?.type === 'tree') {
      if (firstEntry.pointer) {
        nodeData.l = firstEntry.pointer;
      }
    }

    // Build entries with prefix compression
    let prevKeyBytes = new Uint8Array(0);
    let entryIndex = 0;

    for (let i = 0; i < this.nodeEntries.length; i++) {
      const entry = this.nodeEntries[i];

      if (entry.type === 'leaf') {
        const keyBytes = encoder.encode(entry.key);
        const prefixLen = commonPrefixLength(prevKeyBytes, keyBytes);
        const suffix = keyBytes.slice(prefixLen);

        // Look ahead for right subtree
        let rightTree: CID | null = null;
        if (i + 1 < this.nodeEntries.length && this.nodeEntries[i + 1].type === 'tree') {
          const treeEntry = this.nodeEntries[i + 1] as TreePointer;
          rightTree = treeEntry.pointer;
        }

        nodeData.e.push({
          p: prefixLen,
          k: suffix,
          v: entry.value,
          t: rightTree,
        });

        prevKeyBytes = keyBytes;
        entryIndex++;
      }
    }

    const { cid, bytes } = await cidForData(nodeData);
    return { cid, bytes };
  }

  /**
   * Get or compute the CID pointer for this node
   */
  async getPointer(): Promise<CID> {
    if (!this.outdated && this.pointer) {
      return this.pointer;
    }

    const { cid, bytes } = await this.serialize();
    await this.blockStore.put(cid, bytes);
    this.pointer = cid;
    this.outdated = false;
    return cid;
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<CID | null> {
    const found = this.findLeafIndex(key);
    if (found.found) {
      return found.leaf.value;
    }

    // Key not found at this level, check subtree
    if (found.subtree) {
      const subtreeNode = await this.loadSubtree(found.subtree);
      return subtreeNode.get(key);
    }

    return null;
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /**
   * Add or update a key-value pair
   */
  async add(key: string, value: CID, knownLayer?: number): Promise<MSTNode> {
    validateKey(key);

    const keyLayer = knownLayer ?? (await layerForKey(key));
    const nodeLayer = await this.getLayer();

    // If this node is at the wrong layer for this key, we need to restructure
    if (nodeLayer === null || keyLayer > nodeLayer) {
      // Need to create a new layer above this one
      return this.createNewRoot(key, value, keyLayer);
    }

    if (keyLayer < nodeLayer) {
      // Key belongs in a subtree below this level
      return this.addToSubtree(key, value, keyLayer);
    }

    // Key belongs at this level (keyLayer === nodeLayer)
    return this.addAtThisLevel(key, value);
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<MSTNode> {
    const keyLayer = await layerForKey(key);
    const nodeLayer = await this.getLayer();

    if (nodeLayer === null) {
      // Empty tree, nothing to delete
      return this;
    }

    if (keyLayer > nodeLayer) {
      // Key would be above this level, so it doesn't exist
      return this;
    }

    if (keyLayer < nodeLayer) {
      // Key would be in a subtree
      return this.deleteFromSubtree(key, keyLayer);
    }

    // Key would be at this level
    return this.deleteAtThisLevel(key);
  }

  /**
   * Get all key-value pairs
   */
  async *entries(): AsyncGenerator<[string, CID]> {
    for (const entry of this.nodeEntries) {
      if (entry.type === 'tree' && entry.pointer) {
        const subtree = await this.loadSubtree(entry.pointer);
        yield* subtree.entries();
      } else if (entry.type === 'leaf') {
        yield [entry.key, entry.value];
      }
    }
  }

  /**
   * Get all keys
   */
  async *keys(): AsyncGenerator<string> {
    for await (const [key] of this.entries()) {
      yield key;
    }
  }

  /**
   * Get all values
   */
  async *values(): AsyncGenerator<CID> {
    for await (const [, value] of this.entries()) {
      yield value;
    }
  }

  /**
   * Count total entries (leaves) in the tree
   */
  async count(): Promise<number> {
    let total = 0;
    for await (const _ of this.entries()) {
      total++;
    }
    return total;
  }

  /**
   * Check if the tree is empty
   */
  isEmpty(): boolean {
    return this.nodeEntries.length === 0;
  }

  /**
   * Get the layer/depth of this node
   */
  async getLayer(): Promise<number | null> {
    if (this.layer !== null) {
      return this.layer;
    }

    // Find first leaf to determine layer
    for (const entry of this.nodeEntries) {
      if (entry.type === 'leaf') {
        this.layer = await layerForKey(entry.key);
        return this.layer;
      }
      if (entry.type === 'tree' && entry.pointer) {
        const subtree = await this.loadSubtree(entry.pointer);
        const subtreeLayer = await subtree.getLayer();
        if (subtreeLayer !== null) {
          // This node is one layer above the subtree
          this.layer = subtreeLayer + 1;
          return this.layer;
        }
      }
    }

    return null;
  }

  /**
   * Calculate diff between this tree and another
   */
  async diff(other: MSTNode): Promise<DiffResult> {
    const result: DiffResult = {
      adds: new Map(),
      updates: new Map(),
      deletes: new Map(),
      newCids: new Set(),
    };

    // Get all entries from both trees
    const thisEntries = new Map<string, CID>();
    const otherEntries = new Map<string, CID>();

    for await (const [key, value] of this.entries()) {
      thisEntries.set(key, value);
    }
    for await (const [key, value] of other.entries()) {
      otherEntries.set(key, value);
    }

    // Find adds and updates
    for (const [key, value] of otherEntries) {
      const oldValue = thisEntries.get(key);
      if (!oldValue) {
        result.adds.set(key, value);
        result.newCids.add(value.toString());
      } else if (!oldValue.equals(value)) {
        result.updates.set(key, { old: oldValue, new: value });
        result.newCids.add(value.toString());
      }
    }

    // Find deletes
    for (const [key, value] of thisEntries) {
      if (!otherEntries.has(key)) {
        result.deletes.set(key, value);
      }
    }

    return result;
  }

  /**
   * Create a new tree from a map of entries
   */
  static async fromEntries(
    entries: Map<string, CID> | Array<[string, CID]>,
    blockStore?: BlockStore
  ): Promise<MSTNode> {
    let tree = MSTNode.create(blockStore);
    const entriesArray = entries instanceof Map ? [...entries] : entries;

    for (const [key, value] of entriesArray) {
      tree = await tree.add(key, value);
    }

    return tree;
  }

  // Private helper methods

  /**
   * Find the index of a leaf by key, or the subtree it would be in
   */
  private findLeafIndex(
    key: string
  ): { found: true; index: number; leaf: Leaf } | { found: false; subtree: CID | null } {
    let lastSubtree: CID | null = null;

    for (let i = 0; i < this.nodeEntries.length; i++) {
      const entry = this.nodeEntries[i];

      if (entry.type === 'tree') {
        lastSubtree = entry.pointer;
      } else if (entry.type === 'leaf') {
        const cmp = compareKeys(entry.key, key);
        if (cmp === 0) {
          return { found: true, index: i, leaf: entry };
        }
        if (cmp > 0) {
          // Current key is greater, so target would be in previous subtree
          return { found: false, subtree: lastSubtree };
        }
        lastSubtree = null;
      }
    }

    // Check last subtree
    const lastEntry = this.nodeEntries[this.nodeEntries.length - 1];
    if (lastEntry?.type === 'tree') {
      return { found: false, subtree: lastEntry.pointer };
    }

    return { found: false, subtree: null };
  }

  /**
   * Find the insertion point for a key
   */
  private findInsertionPoint(key: string): { index: number; subtreeBefore: CID | null } {
    let subtreeBefore: CID | null = null;
    let insertIndex = 0;

    for (let i = 0; i < this.nodeEntries.length; i++) {
      const entry = this.nodeEntries[i];

      if (entry.type === 'tree') {
        subtreeBefore = entry.pointer;
        insertIndex = i + 1;
      } else if (entry.type === 'leaf') {
        const cmp = compareKeys(entry.key, key);
        if (cmp >= 0) {
          return { index: insertIndex, subtreeBefore };
        }
        subtreeBefore = null;
        insertIndex = i + 1;
      }
    }

    return { index: this.nodeEntries.length, subtreeBefore };
  }

  /**
   * Load a subtree from a CID
   */
  private async loadSubtree(pointer: CID): Promise<MSTNode> {
    return MSTNode.load(this.blockStore, pointer);
  }

  /**
   * Create a new node with updated entries
   */
  private newNode(entries: Entry[]): MSTNode {
    return new MSTNode(this.blockStore, entries, null);
  }

  /**
   * Create a new root when key belongs above current level
   */
  private async createNewRoot(key: string, value: CID, keyLayer: number): Promise<MSTNode> {
    // Current tree becomes a subtree
    const currentPointer = await this.getPointer();

    // Split current tree at the key
    const { left, right } = await this.splitAt(key);

    const entries: Entry[] = [];

    // Left subtree (if not empty)
    if (left && !left.isEmpty()) {
      const leftPointer = await left.getPointer();
      entries.push({ type: 'tree', pointer: leftPointer });
    }

    // The new key
    entries.push({ type: 'leaf', key, value });

    // Right subtree (if not empty)
    if (right && !right.isEmpty()) {
      const rightPointer = await right.getPointer();
      entries.push({ type: 'tree', pointer: rightPointer });
    }

    const node = this.newNode(entries);
    node.layer = keyLayer;
    return node;
  }

  /**
   * Add a key to a subtree below this level
   */
  private async addToSubtree(key: string, value: CID, keyLayer: number): Promise<MSTNode> {
    const { index, subtreeBefore } = this.findInsertionPoint(key);

    const newEntries = [...this.nodeEntries];

    if (subtreeBefore) {
      // Add to existing subtree
      const subtree = await this.loadSubtree(subtreeBefore);
      const newSubtree = await subtree.add(key, value, keyLayer);
      const newPointer = await newSubtree.getPointer();

      // Find and update the tree pointer
      for (let i = index - 1; i >= 0; i--) {
        if (newEntries[i].type === 'tree') {
          newEntries[i] = { type: 'tree', pointer: newPointer };
          break;
        }
      }
    } else {
      // Create new subtree with just this entry
      const newSubtree = MSTNode.create(this.blockStore);
      const subtreeWithEntry = await newSubtree.add(key, value, keyLayer);
      const newPointer = await subtreeWithEntry.getPointer();

      // Insert tree pointer before the insertion point
      newEntries.splice(index, 0, { type: 'tree', pointer: newPointer });
    }

    return this.newNode(newEntries);
  }

  /**
   * Add a key at this level
   */
  private async addAtThisLevel(key: string, value: CID): Promise<MSTNode> {
    const { index, subtreeBefore } = this.findInsertionPoint(key);

    // Check if key already exists
    const found = this.findLeafIndex(key);
    if (found.found) {
      // Update existing entry
      const newEntries = [...this.nodeEntries];
      newEntries[found.index] = { type: 'leaf', key, value };
      return this.newNode(newEntries);
    }

    const newEntries = [...this.nodeEntries];

    // If there's a subtree before the insertion point, we need to split it
    if (subtreeBefore) {
      const subtree = await this.loadSubtree(subtreeBefore);
      const { left, right } = await subtree.splitAt(key);

      // Find the tree pointer to replace
      let treeIndex = index - 1;
      while (treeIndex >= 0 && newEntries[treeIndex].type !== 'tree') {
        treeIndex--;
      }

      if (treeIndex >= 0) {
        // Replace with left, insert key, add right
        const insertions: Entry[] = [];

        if (left && !left.isEmpty()) {
          const leftPointer = await left.getPointer();
          insertions.push({ type: 'tree', pointer: leftPointer });
        }

        insertions.push({ type: 'leaf', key, value });

        if (right && !right.isEmpty()) {
          const rightPointer = await right.getPointer();
          insertions.push({ type: 'tree', pointer: rightPointer });
        }

        newEntries.splice(treeIndex, 1, ...insertions);
      }
    } else {
      // Simple insertion
      newEntries.splice(index, 0, { type: 'leaf', key, value });
    }

    return this.newNode(newEntries);
  }

  /**
   * Delete a key from a subtree
   */
  private async deleteFromSubtree(key: string, keyLayer: number): Promise<MSTNode> {
    const found = this.findLeafIndex(key);
    if (found.found) {
      // Key exists at this level? Shouldn't happen if keyLayer < nodeLayer
      return this;
    }

    if (!found.subtree) {
      // Key doesn't exist
      return this;
    }

    const subtree = await this.loadSubtree(found.subtree);
    const newSubtree = await subtree.delete(key);

    // Find and update the subtree pointer
    const newEntries = [...this.nodeEntries];
    for (let i = 0; i < newEntries.length; i++) {
      const entry = newEntries[i];
      if (entry.type === 'tree' && entry.pointer?.equals(found.subtree)) {
        if (newSubtree.isEmpty()) {
          // Remove empty subtree
          newEntries.splice(i, 1);
        } else {
          const newPointer = await newSubtree.getPointer();
          newEntries[i] = { type: 'tree', pointer: newPointer };
        }
        break;
      }
    }

    return this.trimTop(this.newNode(newEntries));
  }

  /**
   * Delete a key at this level
   */
  private async deleteAtThisLevel(key: string): Promise<MSTNode> {
    const found = this.findLeafIndex(key);
    if (!found.found) {
      // Check subtree
      if (found.subtree) {
        return this.deleteFromSubtree(key, await layerForKey(key));
      }
      return this;
    }

    const newEntries = [...this.nodeEntries];
    const { index } = found;

    // Check for adjacent subtrees that need merging
    const prevEntry = newEntries[index - 1];
    const nextEntry = newEntries[index + 1];

    if (prevEntry?.type === 'tree' && nextEntry?.type === 'tree') {
      // Merge the two subtrees
      const leftSubtree = prevEntry.pointer ? await this.loadSubtree(prevEntry.pointer) : null;
      const rightSubtree = nextEntry.pointer ? await this.loadSubtree(nextEntry.pointer) : null;

      if (leftSubtree && rightSubtree) {
        const merged = await this.mergeSubtrees(leftSubtree, rightSubtree);
        const mergedPointer = await merged.getPointer();

        // Replace prev tree, leaf, next tree with merged tree
        newEntries.splice(index - 1, 3, { type: 'tree', pointer: mergedPointer });
      } else if (leftSubtree) {
        newEntries.splice(index, 2);
      } else if (rightSubtree) {
        newEntries.splice(index - 1, 2);
      } else {
        newEntries.splice(index - 1, 3);
      }
    } else if (prevEntry?.type === 'tree' && !nextEntry) {
      // Just remove the leaf
      newEntries.splice(index, 1);
    } else if (nextEntry?.type === 'tree' && !prevEntry) {
      // Just remove the leaf
      newEntries.splice(index, 1);
    } else {
      // Simple removal
      newEntries.splice(index, 1);
    }

    return this.trimTop(this.newNode(newEntries));
  }

  /**
   * Split the tree at a key
   * Returns entries less than key (left) and entries >= key (right)
   */
  private async splitAt(key: string): Promise<{ left: MSTNode | null; right: MSTNode | null }> {
    const leftEntries: Entry[] = [];
    const rightEntries: Entry[] = [];

    let passedKey = false;

    for (const entry of this.nodeEntries) {
      if (entry.type === 'tree') {
        if (!passedKey) {
          // Need to recursively split this subtree
          if (entry.pointer) {
            const subtree = await this.loadSubtree(entry.pointer);
            const { left, right } = await subtree.splitAt(key);
            if (left && !left.isEmpty()) {
              leftEntries.push({ type: 'tree', pointer: await left.getPointer() });
            }
            if (right && !right.isEmpty()) {
              rightEntries.push({ type: 'tree', pointer: await right.getPointer() });
            }
          }
        } else {
          rightEntries.push(entry);
        }
      } else if (entry.type === 'leaf') {
        const cmp = compareKeys(entry.key, key);
        if (cmp < 0) {
          leftEntries.push(entry);
        } else {
          passedKey = true;
          rightEntries.push(entry);
        }
      }
    }

    return {
      left: leftEntries.length > 0 ? this.newNode(leftEntries) : null,
      right: rightEntries.length > 0 ? this.newNode(rightEntries) : null,
    };
  }

  /**
   * Merge two subtrees
   */
  private async mergeSubtrees(left: MSTNode, right: MSTNode): Promise<MSTNode> {
    // Collect all entries from both trees
    const allEntries: [string, CID][] = [];

    for await (const entry of left.entries()) {
      allEntries.push(entry);
    }
    for await (const entry of right.entries()) {
      allEntries.push(entry);
    }

    // Sort by key
    allEntries.sort((a, b) => compareKeys(a[0], b[0]));

    // Build new tree
    return MSTNode.fromEntries(allEntries, this.blockStore);
  }

  /**
   * Trim empty top layers
   */
  private async trimTop(node: MSTNode): Promise<MSTNode> {
    // If node has no leaves and only one subtree, promote that subtree
    const leaves = node.nodeEntries.filter((e) => e.type === 'leaf');
    const trees = node.nodeEntries.filter((e) => e.type === 'tree') as TreePointer[];

    if (leaves.length === 0 && trees.length === 1 && trees[0].pointer) {
      return this.loadSubtree(trees[0].pointer);
    }

    return node;
  }
}

/**
 * Main MST class - wraps MSTNode with a simpler API
 */
export class MST {
  private root: MSTNode;
  private blockStore: BlockStore;

  constructor(blockStore?: BlockStore) {
    this.blockStore = blockStore || new MemoryBlockStore();
    this.root = MSTNode.create(this.blockStore);
  }

  /**
   * Create an empty MST
   */
  static create(blockStore?: BlockStore): MST {
    return new MST(blockStore);
  }

  /**
   * Load an MST from a root CID
   */
  static async load(blockStore: BlockStore, rootCid: CID): Promise<MST> {
    const mst = new MST(blockStore);
    mst.root = await MSTNode.load(blockStore, rootCid);
    return mst;
  }

  /**
   * Get the root CID
   */
  async getPointer(): Promise<CID> {
    return this.root.getPointer();
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<CID | null> {
    return this.root.get(key);
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    return this.root.has(key);
  }

  /**
   * Add or update a key-value pair
   */
  async add(key: string, value: CID): Promise<void> {
    this.root = await this.root.add(key, value);
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    this.root = await this.root.delete(key);
  }

  /**
   * Iterate over all entries
   */
  async *entries(): AsyncGenerator<[string, CID]> {
    yield* this.root.entries();
  }

  /**
   * Iterate over all keys
   */
  async *keys(): AsyncGenerator<string> {
    yield* this.root.keys();
  }

  /**
   * Iterate over all values
   */
  async *values(): AsyncGenerator<CID> {
    yield* this.root.values();
  }

  /**
   * Count total entries
   */
  async count(): Promise<number> {
    return this.root.count();
  }

  /**
   * Check if tree is empty
   */
  isEmpty(): boolean {
    return this.root.isEmpty();
  }

  /**
   * Get diff from another MST
   */
  async diff(other: MST): Promise<DiffResult> {
    return this.root.diff(other.root);
  }

  /**
   * Create from entries
   */
  static async fromEntries(
    entries: Map<string, CID> | Array<[string, CID]>,
    blockStore?: BlockStore
  ): Promise<MST> {
    const mst = new MST(blockStore);
    mst.root = await MSTNode.fromEntries(entries, mst.blockStore);
    return mst;
  }

  /**
   * Get all entries as a Map
   */
  async toMap(): Promise<Map<string, CID>> {
    const map = new Map<string, CID>();
    for await (const [key, value] of this.entries()) {
      map.set(key, value);
    }
    return map;
  }

  /**
   * Get the block store
   */
  getBlockStore(): BlockStore {
    return this.blockStore;
  }
}

export default MST;
