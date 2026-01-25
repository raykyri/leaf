/**
 * com.atproto.repo.* XRPC Routes
 * Repository management endpoints
 */

import type { Context } from 'hono';
import { xrpcError, verifyAuth } from '../index.ts';
import { getRepository, generateTid, repositoryExists } from '../../repo/index.ts';
import { uploadBlob, createBlobRef, addBlobReference, removeBlobReference } from '../../blob/index.ts';
import { getSocialUserSigningKey } from '../../social-auth/index.ts';
import { getDatabase } from '../../../database/index.ts';
import { getPDSConfig } from '../../config.ts';
import { isValidCollection, isValidRkey, isValidDid } from '../../utils.ts';

/**
 * com.atproto.repo.createRecord
 * Create a new record in a repository
 */
export async function handleCreateRecord(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  try {
    const body = await c.req.json();
    const { repo, collection, rkey, record, validate, swapCommit } = body;

    // Verify user owns the repo
    if (repo !== auth.did) {
      return xrpcError(c, 'InvalidRequest', 'Cannot write to another user\'s repository', 403);
    }

    // Validate required fields
    if (!collection || !record) {
      return xrpcError(c, 'InvalidRequest', 'collection and record are required', 400);
    }

    // Validate collection NSID format
    if (!isValidCollection(collection)) {
      return xrpcError(c, 'InvalidRequest', 'Invalid collection NSID format', 400);
    }

    // Validate rkey if provided
    if (rkey && !isValidRkey(rkey)) {
      return xrpcError(c, 'InvalidRequest', 'Invalid record key format', 400);
    }

    // Get signing key
    const signingKey = await getSocialUserSigningKey(auth.userId);
    if (!signingKey) {
      return xrpcError(c, 'InternalServerError', 'Failed to get signing key', 500);
    }

    // Generate rkey if not provided
    const recordKey = rkey || generateTid();

    // Create record
    const repository = getRepository(auth.did);
    const result = await repository.createRecord(collection, recordKey, record, signingKey);

    // Handle blob references in record
    await processBlobReferences(auth.did, collection, recordKey, record);

    return c.json({
      uri: `at://${auth.did}/${collection}/${recordKey}`,
      cid: result.cid.toString(),
    });
  } catch (error) {
    console.error('createRecord error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to create record', 500);
  }
}

/**
 * com.atproto.repo.getRecord
 * Get a specific record from a repository
 */
export async function handleGetRecord(c: Context): Promise<Response> {
  const repo = c.req.query('repo');
  const collection = c.req.query('collection');
  const rkey = c.req.query('rkey');

  if (!repo || !collection || !rkey) {
    return xrpcError(c, 'InvalidRequest', 'repo, collection, and rkey are required', 400);
  }

  // Validate formats
  if (!isValidDid(repo)) {
    return xrpcError(c, 'InvalidRequest', 'Invalid repo DID format', 400);
  }
  if (!isValidCollection(collection)) {
    return xrpcError(c, 'InvalidRequest', 'Invalid collection NSID format', 400);
  }
  if (!isValidRkey(rkey)) {
    return xrpcError(c, 'InvalidRequest', 'Invalid record key format', 400);
  }

  // Check if repo exists on this PDS
  if (!repositoryExists(repo)) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  const repository = getRepository(repo);
  const record = await repository.getRecord(collection, rkey);

  if (!record) {
    return xrpcError(c, 'RecordNotFound', 'Record not found', 404);
  }

  // Get CID from index
  const db = getDatabase();
  const row = db
    .prepare('SELECT cid FROM repo_records WHERE repo_did = ? AND collection = ? AND rkey = ?')
    .get(repo, collection, rkey) as { cid: string } | undefined;

  return c.json({
    uri: `at://${repo}/${collection}/${rkey}`,
    cid: row?.cid,
    value: record,
  });
}

/**
 * com.atproto.repo.listRecords
 * List records in a collection
 */
export async function handleListRecords(c: Context): Promise<Response> {
  const repo = c.req.query('repo');
  const collection = c.req.query('collection');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const cursor = c.req.query('cursor');
  const reverse = c.req.query('reverse') === 'true';

  if (!repo || !collection) {
    return xrpcError(c, 'InvalidRequest', 'repo and collection are required', 400);
  }

  // Validate formats
  if (!isValidDid(repo)) {
    return xrpcError(c, 'InvalidRequest', 'Invalid repo DID format', 400);
  }
  if (!isValidCollection(collection)) {
    return xrpcError(c, 'InvalidRequest', 'Invalid collection NSID format', 400);
  }

  // Validate limit range
  if (limit < 1 || limit > 100) {
    return xrpcError(c, 'InvalidRequest', 'limit must be between 1 and 100', 400);
  }

  if (!repositoryExists(repo)) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  const repository = getRepository(repo);
  const result = await repository.listRecords(collection, { limit, cursor, reverse });

  return c.json({
    records: result.records,
    cursor: result.cursor,
  });
}

/**
 * com.atproto.repo.deleteRecord
 * Delete a record from a repository
 */
export async function handleDeleteRecord(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  try {
    const body = await c.req.json();
    const { repo, collection, rkey, swapRecord, swapCommit } = body;

    if (repo !== auth.did) {
      return xrpcError(c, 'InvalidRequest', 'Cannot delete from another user\'s repository', 403);
    }

    if (!collection || !rkey) {
      return xrpcError(c, 'InvalidRequest', 'collection and rkey are required', 400);
    }

    // Validate formats
    if (!isValidCollection(collection)) {
      return xrpcError(c, 'InvalidRequest', 'Invalid collection NSID format', 400);
    }
    if (!isValidRkey(rkey)) {
      return xrpcError(c, 'InvalidRequest', 'Invalid record key format', 400);
    }

    const signingKey = await getSocialUserSigningKey(auth.userId);
    if (!signingKey) {
      return xrpcError(c, 'InternalServerError', 'Failed to get signing key', 500);
    }

    // Remove blob references before deleting
    removeBlobReference(auth.did, collection, rkey);

    const repository = getRepository(auth.did);
    await repository.deleteRecord(collection, rkey, signingKey);

    return c.json({});
  } catch (error) {
    console.error('deleteRecord error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to delete record', 500);
  }
}

/**
 * com.atproto.repo.putRecord
 * Create or update a record
 */
export async function handlePutRecord(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  try {
    const body = await c.req.json();
    const { repo, collection, rkey, record, validate, swapRecord, swapCommit } = body;

    if (repo !== auth.did) {
      return xrpcError(c, 'InvalidRequest', 'Cannot write to another user\'s repository', 403);
    }

    if (!collection || !rkey || !record) {
      return xrpcError(c, 'InvalidRequest', 'collection, rkey, and record are required', 400);
    }

    // Validate formats
    if (!isValidCollection(collection)) {
      return xrpcError(c, 'InvalidRequest', 'Invalid collection NSID format', 400);
    }
    if (!isValidRkey(rkey)) {
      return xrpcError(c, 'InvalidRequest', 'Invalid record key format', 400);
    }

    const signingKey = await getSocialUserSigningKey(auth.userId);
    if (!signingKey) {
      return xrpcError(c, 'InternalServerError', 'Failed to get signing key', 500);
    }

    const repository = getRepository(auth.did);

    // Check if record exists to determine create vs update
    const existing = await repository.getRecord(collection, rkey);
    const result = existing
      ? await repository.updateRecord(collection, rkey, record, signingKey)
      : await repository.createRecord(collection, rkey, record, signingKey);

    // Handle blob references
    await processBlobReferences(auth.did, collection, rkey, record);

    return c.json({
      uri: `at://${auth.did}/${collection}/${rkey}`,
      cid: result.cid.toString(),
    });
  } catch (error) {
    console.error('putRecord error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to put record', 500);
  }
}

/**
 * com.atproto.repo.applyWrites
 * Apply multiple write operations atomically
 */
export async function handleApplyWrites(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  try {
    const body = await c.req.json();
    const { repo, writes, validate, swapCommit } = body;

    if (repo !== auth.did) {
      return xrpcError(c, 'InvalidRequest', 'Cannot write to another user\'s repository', 403);
    }

    if (!writes || !Array.isArray(writes) || writes.length === 0) {
      return xrpcError(c, 'InvalidRequest', 'writes array is required', 400);
    }

    const signingKey = await getSocialUserSigningKey(auth.userId);
    if (!signingKey) {
      return xrpcError(c, 'InternalServerError', 'Failed to get signing key', 500);
    }

    // Validate and transform writes to internal format
    const writeOps: Array<{
      action: 'create' | 'update' | 'delete';
      collection: string;
      rkey: string;
      record?: unknown;
    }> = [];

    for (const write of writes) {
      const { $type, collection, rkey, value } = write as {
        $type: string;
        collection: string;
        rkey?: string;
        value?: unknown;
      };

      let action: 'create' | 'update' | 'delete';

      if ($type === 'com.atproto.repo.applyWrites#create') {
        action = 'create';
      } else if ($type === 'com.atproto.repo.applyWrites#update') {
        action = 'update';
      } else if ($type === 'com.atproto.repo.applyWrites#delete') {
        action = 'delete';
      } else {
        return xrpcError(c, 'InvalidRequest', `Unknown write type: ${$type}`, 400);
      }

      // Validate collection NSID
      if (!collection || !isValidCollection(collection)) {
        return xrpcError(c, 'InvalidRequest', 'Invalid collection NSID format in write operation', 400);
      }

      // Validate rkey if provided
      const recordKey = rkey || generateTid();
      if (rkey && !isValidRkey(rkey)) {
        return xrpcError(c, 'InvalidRequest', 'Invalid record key format in write operation', 400);
      }

      writeOps.push({
        action,
        collection,
        rkey: recordKey,
        record: value,
      });
    }

    const repository = getRepository(auth.did);
    const result = await repository.applyWrites(writeOps, signingKey);

    // Handle blob references for each write
    for (const write of writeOps) {
      if (write.action === 'delete') {
        removeBlobReference(auth.did, write.collection, write.rkey);
      } else if (write.record) {
        await processBlobReferences(auth.did, write.collection, write.rkey, write.record);
      }
    }

    return c.json({
      commit: {
        cid: result.cid.toString(),
        rev: result.rev,
      },
      results: writeOps.map((write) => ({
        uri: `at://${auth.did}/${write.collection}/${write.rkey}`,
        cid: result.cid.toString(),
      })),
    });
  } catch (error) {
    console.error('applyWrites error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to apply writes', 500);
  }
}

/**
 * com.atproto.repo.describeRepo
 * Get repository metadata
 */
export async function handleDescribeRepo(c: Context): Promise<Response> {
  const repo = c.req.query('repo');

  if (!repo) {
    return xrpcError(c, 'InvalidRequest', 'repo is required', 400);
  }

  if (!repositoryExists(repo)) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  const db = getDatabase();

  // Get user info
  const user = db.prepare('SELECT handle, did FROM users WHERE did = ?').get(repo) as {
    handle: string;
    did: string;
  } | undefined;

  if (!user) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  // Get collections
  const collections = db
    .prepare('SELECT DISTINCT collection FROM repo_records WHERE repo_did = ?')
    .all(repo) as Array<{ collection: string }>;

  return c.json({
    handle: user.handle,
    did: user.did,
    didDoc: {}, // Could include full DID document
    collections: collections.map((c) => c.collection),
    handleIsCorrect: true,
  });
}

/**
 * com.atproto.repo.uploadBlob
 * Upload a blob (media file)
 */
export async function handleUploadBlob(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  try {
    const contentType = c.req.header('Content-Type') || 'application/octet-stream';
    const body = await c.req.arrayBuffer();
    const data = new Uint8Array(body);

    const config = getPDSConfig();
    if (data.length > config.maxBlobSize) {
      return xrpcError(
        c,
        'BlobTooLarge',
        `Blob exceeds maximum size of ${config.maxBlobSize} bytes`,
        400
      );
    }

    const blob = await uploadBlob(auth.did, data, contentType);
    const blobRef = createBlobRef(blob);

    return c.json({
      blob: blobRef,
    });
  } catch (error) {
    console.error('uploadBlob error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to upload blob', 500);
  }
}

/**
 * Process blob references in a record and add them to the reference table
 */
async function processBlobReferences(
  did: string,
  collection: string,
  rkey: string,
  record: unknown
): Promise<void> {
  // First, remove existing references for this record
  removeBlobReference(did, collection, rkey);

  // Find all blob refs in the record
  const blobCids = findBlobRefs(record);

  // Add new references
  for (const cid of blobCids) {
    addBlobReference(cid, did, collection, rkey);
  }
}

/**
 * Recursively find all blob references in a record
 */
function findBlobRefs(obj: unknown): string[] {
  const refs: string[] = [];

  if (!obj || typeof obj !== 'object') {
    return refs;
  }

  // Type guard for blob ref
  const record = obj as Record<string, unknown>;

  // Check if this is a blob ref
  if (record.$type === 'blob') {
    const ref = record.ref as Record<string, unknown> | undefined;
    if (ref?.$link && typeof ref.$link === 'string') {
      refs.push(ref.$link);
    }
  }

  // Recurse into arrays and objects
  if (Array.isArray(obj)) {
    for (const item of obj) {
      refs.push(...findBlobRefs(item));
    }
  } else {
    for (const value of Object.values(record)) {
      refs.push(...findBlobRefs(value));
    }
  }

  return refs;
}
