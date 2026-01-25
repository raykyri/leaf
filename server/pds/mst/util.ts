/**
 * MST Utility Functions
 * Helper functions for MST operations
 */

import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
// @ts-ignore - dag-cbor types
import * as dagCbor from '@ipld/dag-cbor';

/**
 * Count the number of leading zero bits in a byte array
 */
export function countLeadingZeros(bytes: Uint8Array): number {
  let count = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      count += 8;
    } else {
      // Count leading zeros in this byte
      let mask = 0x80; // 10000000
      while ((byte & mask) === 0 && mask > 0) {
        count++;
        mask >>= 1;
      }
      break;
    }
  }
  return count;
}

/**
 * Calculate the layer/depth for a key based on its hash
 *
 * Per ATProto spec: "Count the number of leading binary zeros in the hash,
 * and divide by two, rounding down"
 *
 * This produces a fanout of 4 (2^2) since we're counting in 2-bit chunks.
 *
 * @param key The key as a string or bytes
 * @returns The layer number (0 = bottom/leaf layer, higher = closer to root)
 */
export async function layerForKey(key: string | Uint8Array): Promise<number> {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const hash = await sha256.digest(keyBytes);
  const leadingZeros = countLeadingZeros(hash.digest);
  return Math.floor(leadingZeros / 2);
}

/**
 * Synchronous version of layerForKey using Node.js crypto
 * For when we need synchronous operations
 */
export function layerForKeySync(key: string | Uint8Array): number {
  const keyBytes = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  // Use Node.js crypto for synchronous hashing
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(keyBytes).digest();
  const leadingZeros = countLeadingZeros(hash);
  return Math.floor(leadingZeros / 2);
}

/**
 * Compare two byte arrays lexicographically
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return a.length - b.length;
}

/**
 * Compare two string keys lexicographically by their UTF-8 bytes
 */
export function compareKeys(a: string, b: string): number {
  const encoder = new TextEncoder();
  return compareBytes(encoder.encode(a), encoder.encode(b));
}

/**
 * Calculate the common prefix length between two byte arrays
 */
export function commonPrefixLength(a: Uint8Array, b: Uint8Array): number {
  const minLen = Math.min(a.length, b.length);
  let i = 0;
  while (i < minLen && a[i] === b[i]) {
    i++;
  }
  return i;
}

/**
 * Encode data as DAG-CBOR and compute its CID
 */
export async function cidForData(data: unknown): Promise<{ cid: CID; bytes: Uint8Array }> {
  const bytes = dagCbor.encode(data);
  const hash = await sha256.digest(bytes);
  const cid = CID.createV1(dagCbor.code, hash);
  return { cid, bytes };
}

/**
 * Decode DAG-CBOR data
 */
export function decodeCbor<T>(bytes: Uint8Array): T {
  return dagCbor.decode(bytes) as T;
}

/**
 * Encode data as DAG-CBOR
 */
export function encodeCbor(data: unknown): Uint8Array {
  return dagCbor.encode(data);
}

/**
 * Validate an MST key
 * Keys must:
 * - Be non-empty
 * - Contain exactly one '/' separating collection and rkey
 * - Be valid ASCII
 * - Be <= 1024 bytes
 *
 * @throws Error if key is invalid
 */
export function validateKey(key: string): void {
  if (!key) {
    throw new Error('MST key cannot be empty');
  }

  if (key.length > 1024) {
    throw new Error('MST key exceeds maximum length of 1024 characters');
  }

  // Check for valid ASCII (no control characters, etc.)
  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      throw new Error('MST key contains invalid characters (must be printable ASCII)');
    }
  }

  // Must have exactly one '/' separating collection and rkey
  const slashIndex = key.indexOf('/');
  if (slashIndex === -1) {
    throw new Error('MST key must contain collection and rkey separated by /');
  }
  if (slashIndex === 0) {
    throw new Error('MST key must have a collection before /');
  }
  if (slashIndex === key.length - 1) {
    throw new Error('MST key must have an rkey after /');
  }

  // Check for nested paths (multiple slashes in rkey)
  const afterSlash = key.slice(slashIndex + 1);
  if (afterSlash.includes('/')) {
    throw new Error('MST key cannot have nested paths (multiple slashes)');
  }
}

/**
 * Parse a key into collection and rkey
 */
export function parseKey(key: string): { collection: string; rkey: string } {
  const slashIndex = key.indexOf('/');
  if (slashIndex === -1) {
    throw new Error('Invalid key format');
  }
  return {
    collection: key.slice(0, slashIndex),
    rkey: key.slice(slashIndex + 1),
  };
}

/**
 * Create a key from collection and rkey
 */
export function createKey(collection: string, rkey: string): string {
  return `${collection}/${rkey}`;
}

/**
 * Test vectors from the ATProto spec
 */
export const TEST_VECTORS = {
  // Key -> expected depth
  keys: {
    '2653ae71': 0,
    'blue': 1,
    'app.bsky.feed.post/454397e440ec': 4,
    'app.bsky.feed.post/9adeb165882c': 8,
  },
  // Empty tree CID
  emptyTreeCid: 'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm',
};

/**
 * Binary search for insertion point
 * Returns the index where the key should be inserted to maintain sorted order
 */
export function findInsertionIndex(keys: string[], target: string): number {
  let low = 0;
  let high = keys.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (compareKeys(keys[mid], target) < 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Ensure a value is a CID instance
 */
export function ensureCID(value: unknown): CID {
  if (CID.asCID(value)) {
    return value as CID;
  }
  if (typeof value === 'string') {
    return CID.parse(value);
  }
  throw new Error('Value is not a valid CID');
}
