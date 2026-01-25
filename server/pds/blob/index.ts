/**
 * Blob Storage
 * Handles media file storage and retrieval for repositories
 */

import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from '../../database/index.ts';
import { getPDSConfig } from '../config.ts';

// Blob ref type used in ATProto records
export interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export interface UploadedBlob {
  cid: CID;
  mimeType: string;
  size: number;
}

export interface BlobInfo {
  cid: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

/**
 * Ensure blob storage directory exists
 */
function ensureStorageDir(): string {
  const config = getPDSConfig();
  const dir = config.blobStoragePath;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

/**
 * Get storage path for a blob
 */
function getBlobPath(cid: CID): string {
  const baseDir = ensureStorageDir();
  const cidStr = cid.toString();

  // Use first 4 chars of CID for sharding
  const shard1 = cidStr.slice(0, 2);
  const shard2 = cidStr.slice(2, 4);

  const dir = path.join(baseDir, shard1, shard2);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return path.join(dir, cidStr);
}

/**
 * Upload a blob and return its reference
 */
export async function uploadBlob(
  did: string,
  data: Uint8Array,
  mimeType: string
): Promise<UploadedBlob> {
  const config = getPDSConfig();

  // Check size limit
  if (data.length > config.maxBlobSize) {
    throw new Error(`Blob exceeds maximum size of ${config.maxBlobSize} bytes`);
  }

  // Compute CID (raw codec for blobs)
  const hash = await sha256.digest(data);
  const cid = CID.createV1(0x55, hash); // 0x55 = raw codec

  // Store blob on disk
  const storagePath = getBlobPath(cid);
  fs.writeFileSync(storagePath, Buffer.from(data));

  // Generate temp key for tracking unattached blobs
  const tempKey = Math.random().toString(36).slice(2);

  // Store metadata in database
  const db = getDatabase();
  db.prepare(
    `INSERT INTO repo_blobs (cid, repo_did, mime_type, size, storage_path, temp_key)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(cid) DO UPDATE SET
       temp_key = excluded.temp_key`
  ).run(cid.toString(), did, mimeType, data.length, storagePath, tempKey);

  return {
    cid,
    mimeType,
    size: data.length,
  };
}

/**
 * Create a blob reference object for use in records
 */
export function createBlobRef(blob: UploadedBlob): BlobRef {
  return {
    $type: 'blob',
    ref: { $link: blob.cid.toString() },
    mimeType: blob.mimeType,
    size: blob.size,
  };
}

/**
 * Get blob data by CID
 */
export async function getBlob(
  did: string,
  cid: string
): Promise<{ data: Uint8Array; mimeType: string } | null> {
  const db = getDatabase();

  const row = db
    .prepare('SELECT storage_path, mime_type FROM repo_blobs WHERE cid = ? AND repo_did = ?')
    .get(cid, did) as { storage_path: string; mime_type: string } | undefined;

  if (!row) {
    return null;
  }

  if (!fs.existsSync(row.storage_path)) {
    return null;
  }

  const data = fs.readFileSync(row.storage_path);
  return {
    data: new Uint8Array(data),
    mimeType: row.mime_type,
  };
}

/**
 * List all blobs for a repository
 */
export function listBlobs(
  did: string,
  options: { limit?: number; cursor?: string } = {}
): { blobs: BlobInfo[]; cursor?: string } {
  const db = getDatabase();
  const limit = Math.min(options.limit || 50, 100);

  let query = 'SELECT cid, mime_type, size, storage_path FROM repo_blobs WHERE repo_did = ?';
  const params: (string | number)[] = [did];

  if (options.cursor) {
    query += ' AND cid > ?';
    params.push(options.cursor);
  }

  query += ' ORDER BY cid ASC LIMIT ?';
  params.push(limit + 1);

  const rows = db.prepare(query).all(...params) as Array<{
    cid: string;
    mime_type: string;
    size: number;
    storage_path: string;
  }>;

  const hasMore = rows.length > limit;
  const results = rows.slice(0, limit);

  const blobs = results.map((row) => ({
    cid: row.cid,
    mimeType: row.mime_type,
    size: row.size,
    storagePath: row.storage_path,
  }));

  return {
    blobs,
    cursor: hasMore ? results[results.length - 1]?.cid : undefined,
  };
}

/**
 * Add a reference from a record to a blob
 */
export function addBlobReference(
  blobCid: string,
  recordDid: string,
  recordCollection: string,
  recordRkey: string
): void {
  const db = getDatabase();

  db.prepare(
    `INSERT INTO repo_blob_refs (blob_cid, record_did, record_collection, record_rkey)
     VALUES (?, ?, ?, ?)
     ON CONFLICT DO NOTHING`
  ).run(blobCid, recordDid, recordCollection, recordRkey);

  // Clear temp key since blob is now attached
  db.prepare('UPDATE repo_blobs SET temp_key = NULL WHERE cid = ?').run(blobCid);
}

/**
 * Remove a reference from a record to a blob
 */
export function removeBlobReference(
  recordDid: string,
  recordCollection: string,
  recordRkey: string
): void {
  const db = getDatabase();

  db.prepare(
    `DELETE FROM repo_blob_refs
     WHERE record_did = ? AND record_collection = ? AND record_rkey = ?`
  ).run(recordDid, recordCollection, recordRkey);
}

/**
 * Delete a blob (only if no references remain)
 */
export async function deleteBlob(cid: string): Promise<boolean> {
  const db = getDatabase();

  // Check for remaining references
  const refCount = db
    .prepare('SELECT COUNT(*) as count FROM repo_blob_refs WHERE blob_cid = ?')
    .get(cid) as { count: number };

  if (refCount.count > 0) {
    return false;
  }

  // Get storage path
  const row = db.prepare('SELECT storage_path FROM repo_blobs WHERE cid = ?').get(cid) as
    | { storage_path: string }
    | undefined;

  if (row && fs.existsSync(row.storage_path)) {
    fs.unlinkSync(row.storage_path);
  }

  // Delete from database
  db.prepare('DELETE FROM repo_blobs WHERE cid = ?').run(cid);

  return true;
}

/**
 * Garbage collect orphaned blobs (no references and older than timeout)
 */
export async function garbageCollectBlobs(maxAgeMinutes: number = 30): Promise<number> {
  const db = getDatabase();

  // Find orphaned blobs (have temp_key and are old)
  const orphans = db
    .prepare(
      `SELECT cid, storage_path FROM repo_blobs
       WHERE temp_key IS NOT NULL
       AND created_at < datetime('now', '-' || ? || ' minutes')`
    )
    .all(maxAgeMinutes) as Array<{ cid: string; storage_path: string }>;

  let deleted = 0;

  for (const orphan of orphans) {
    // Double-check no references exist
    const refCount = db
      .prepare('SELECT COUNT(*) as count FROM repo_blob_refs WHERE blob_cid = ?')
      .get(orphan.cid) as { count: number };

    if (refCount.count === 0) {
      if (fs.existsSync(orphan.storage_path)) {
        fs.unlinkSync(orphan.storage_path);
      }
      db.prepare('DELETE FROM repo_blobs WHERE cid = ?').run(orphan.cid);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Get blobs that are referenced in a record but not uploaded
 */
export function getMissingBlobs(did: string): string[] {
  const db = getDatabase();

  // This would require parsing all records to find blob refs
  // and comparing against uploaded blobs
  // For now, return empty - implement full check later
  return [];
}

/**
 * Validate blob reference in a record
 */
export function validateBlobRef(did: string, ref: BlobRef): boolean {
  if (!ref || ref.$type !== 'blob' || !ref.ref?.$link) {
    return false;
  }

  const db = getDatabase();
  const row = db
    .prepare('SELECT 1 FROM repo_blobs WHERE cid = ? AND repo_did = ?')
    .get(ref.ref.$link, did);

  return !!row;
}
