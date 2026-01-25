/**
 * Blob Storage
 *
 * Manages binary data (images, files) for PDS accounts.
 * Blobs are stored with their CID as the identifier.
 */

import { CID } from 'multiformats/cid';
import * as Block from 'multiformats/block';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import { getPdsConfig } from '../config.ts';
import {
  createPdsBlob,
  getPdsBlobByCid,
  listPdsBlobs,
  deletePdsBlob,
  addPdsBlobRef,
  removePdsBlobRef,
  getBlobRefCount,
  type PdsBlob,
} from '../database/queries.ts';

export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export interface UploadResult {
  cid: string;
  mimeType: string;
  size: number;
  ref: BlobRef;
}

export interface BlobData {
  cid: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',

  // Documents
  'application/pdf',

  // Video (if we want to support it)
  'video/mp4',
  'video/webm',

  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
]);

/**
 * Validate a blob upload
 */
export function validateBlob(data: Buffer, mimeType: string): { valid: boolean; error?: string } {
  const config = getPdsConfig();

  // Check size
  if (data.length > config.maxBlobSize) {
    return {
      valid: false,
      error: `Blob too large. Maximum size is ${config.maxBlobSize} bytes`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      error: `MIME type ${mimeType} is not allowed`,
    };
  }

  // Basic magic number validation for common types
  if (mimeType.startsWith('image/')) {
    if (!validateImageMagic(data, mimeType)) {
      return {
        valid: false,
        error: 'File content does not match declared MIME type',
      };
    }
  }

  return { valid: true };
}

/**
 * Validate image magic numbers
 */
function validateImageMagic(data: Buffer, mimeType: string): boolean {
  if (data.length < 8) return false;

  switch (mimeType) {
    case 'image/jpeg':
      return data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF;

    case 'image/png':
      return (
        data[0] === 0x89 &&
        data[1] === 0x50 &&
        data[2] === 0x4E &&
        data[3] === 0x47
      );

    case 'image/gif':
      return (
        data[0] === 0x47 &&
        data[1] === 0x49 &&
        data[2] === 0x46 &&
        data[3] === 0x38
      );

    case 'image/webp':
      return (
        data[0] === 0x52 &&
        data[1] === 0x49 &&
        data[2] === 0x46 &&
        data[3] === 0x46 &&
        data[8] === 0x57 &&
        data[9] === 0x45 &&
        data[10] === 0x42 &&
        data[11] === 0x50
      );

    case 'image/svg+xml':
      // SVG is text-based, check for XML or SVG tag
      const text = data.toString('utf8', 0, 100).toLowerCase();
      return text.includes('<svg') || text.includes('<?xml');

    default:
      return true;
  }
}

/**
 * Upload a blob
 */
export async function uploadBlob(
  did: string,
  data: Buffer,
  mimeType: string
): Promise<UploadResult> {
  // Validate
  const validation = validateBlob(data, mimeType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Compute CID using raw codec (binary data)
  const block = await Block.encode({
    value: data,
    codec: raw,
    hasher: sha256,
  });

  const cid = block.cid.toString();

  // Check if blob already exists
  const existing = getPdsBlobByCid(cid);
  if (existing) {
    // Return existing blob info
    return {
      cid,
      mimeType: existing.mime_type,
      size: existing.size,
      ref: createBlobRef(cid, existing.mime_type, existing.size),
    };
  }

  // Store blob
  createPdsBlob(did, cid, mimeType, data);

  return {
    cid,
    mimeType,
    size: data.length,
    ref: createBlobRef(cid, mimeType, data.length),
  };
}

/**
 * Get a blob by CID
 */
export function getBlob(cid: string): BlobData | null {
  const blob = getPdsBlobByCid(cid);
  if (!blob) {
    return null;
  }

  return {
    cid: blob.cid,
    mimeType: blob.mime_type,
    size: blob.size,
    data: blob.data,
  };
}

/**
 * List blobs for a DID
 */
export function listBlobsForDid(
  did: string,
  options?: { limit?: number; cursor?: string }
): { blobs: Array<{ cid: string; mimeType: string; size: number }>; cursor?: string } {
  const result = listPdsBlobs(did, options);

  return {
    blobs: result.blobs.map((b: PdsBlob) => ({
      cid: b.cid,
      mimeType: b.mime_type,
      size: b.size,
    })),
    cursor: result.cursor,
  };
}

/**
 * Add a reference from a record to a blob
 */
export function addBlobReference(did: string, blobCid: string, recordUri: string): void {
  addPdsBlobRef(did, blobCid, recordUri);
}

/**
 * Remove a reference from a record to a blob
 */
export function removeBlobReference(blobCid: string, recordUri: string): void {
  removePdsBlobRef(blobCid, recordUri);

  // Check if blob has any remaining references
  const refCount = getBlobRefCount(blobCid);
  if (refCount === 0) {
    // No more references, could delete the blob
    // For now, keep orphaned blobs (they can be cleaned up later)
  }
}

/**
 * Delete an orphaned blob (no references)
 */
export function deleteOrphanedBlob(cid: string): boolean {
  const refCount = getBlobRefCount(cid);
  if (refCount > 0) {
    return false; // Still has references
  }

  return deletePdsBlob(cid);
}

/**
 * Create a blob reference object
 */
export function createBlobRef(cid: string, mimeType: string, size: number): BlobRef {
  return {
    $type: 'blob',
    ref: { $link: cid },
    mimeType,
    size,
  };
}

/**
 * Extract blob CIDs from a record
 */
export function extractBlobCids(record: unknown): string[] {
  const cids: string[] = [];

  function traverse(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        traverse(item);
      }
      return;
    }

    const rec = obj as Record<string, unknown>;

    // Check if this is a blob reference
    if (rec.$type === 'blob' && rec.ref && typeof rec.ref === 'object') {
      const ref = rec.ref as Record<string, unknown>;
      if (typeof ref.$link === 'string') {
        cids.push(ref.$link);
      }
    }

    // Recursively check all properties
    for (const value of Object.values(rec)) {
      traverse(value);
    }
  }

  traverse(record);
  return cids;
}
