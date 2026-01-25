/**
 * XRPC Handlers: com.atproto.repo.*
 *
 * Repository operation endpoints.
 */

import type { Context } from 'hono';
import { getPdsConfig } from '../../config.ts';
import { requireAuth } from './server.ts';
import { getRepository } from '../../repo/repository.ts';
import { uploadBlob, getBlob, extractBlobCids, addBlobReference } from '../../repo/blobs.ts';
import { getPdsAccountByDid, getPdsAccountByDidForRead, countPdsRecords } from '../../database/queries.ts';
import { generateTid } from '../../identity/keys.ts';
import type { EncryptedKeyData } from '../../identity/keys.ts';
import { validateNsid, validateRkey, validateDid } from '../../validation/index.ts';

/**
 * com.atproto.repo.describeRepo
 * Describe a repository
 */
export async function describeRepoHandler(c: Context) {
  const repo = c.req.query('repo');

  if (!repo) {
    return c.json({ error: 'InvalidRequest', message: 'repo parameter required' }, 400);
  }

  // Resolve handle to DID if needed
  const did = repo.startsWith('did:') ? repo : null;
  if (!did) {
    return c.json({ error: 'InvalidRequest', message: 'Invalid repo identifier' }, 400);
  }

  const { account, deactivated } = getPdsAccountByDidForRead(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
  const repository = await getRepository(did, signingKey);
  const description = repository.describe();

  return c.json({
    handle: account.handle,
    did: account.did,
    didDoc: {}, // Could include full DID document
    collections: description.collections,
    handleIsCorrect: true,
    deactivated, // Include deactivation status
  });
}

/**
 * com.atproto.repo.createRecord
 * Create a new record in a repository
 */
export async function createRecordHandler(c: Context) {
  const session = requireAuth(c);
  if (!session) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const { repo, collection, rkey, validate, record, swapCommit } = body as {
    repo?: string;
    collection?: string;
    rkey?: string;
    validate?: boolean;
    record?: unknown;
    swapCommit?: string;
  };

  if (!repo || !collection || !record) {
    return c.json({ error: 'InvalidRequest', message: 'repo, collection, and record required' }, 400);
  }

  // Validate collection name
  const collectionValidation = validateNsid(collection);
  if (!collectionValidation.valid) {
    return c.json({ error: 'InvalidRequest', message: collectionValidation.error }, 400);
  }

  // Validate rkey if provided
  if (rkey) {
    const rkeyValidation = validateRkey(rkey);
    if (!rkeyValidation.valid) {
      return c.json({ error: 'InvalidRequest', message: rkeyValidation.error }, 400);
    }
  }

  // Verify the user owns this repo
  if (repo !== session.did) {
    return c.json({ error: 'AuthRequired', message: 'Cannot write to another user\'s repo' }, 403);
  }

  // Get account for signing key
  const account = getPdsAccountByDid(session.did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Account not found' }, 404);
  }

  const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
  const repository = await getRepository(session.did, signingKey);

  try {
    // Create the record with swapCommit verification
    const result = await repository.createRecord(collection, rkey, record, swapCommit);

    // Track blob references
    const blobCids = extractBlobCids(record);
    for (const cid of blobCids) {
      addBlobReference(session.did, cid, result.uri);
    }

    return c.json({
      uri: result.uri,
      cid: result.cid.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create record';
    // Check for swap errors
    if (message.includes('InvalidSwap')) {
      return c.json({ error: 'InvalidSwap', message }, 400);
    }
    return c.json({ error: 'InvalidRequest', message }, 400);
  }
}

/**
 * com.atproto.repo.putRecord
 * Create or update a record
 */
export async function putRecordHandler(c: Context) {
  const session = requireAuth(c);
  if (!session) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const { repo, collection, rkey, validate, record, swapRecord, swapCommit } = body as {
    repo?: string;
    collection?: string;
    rkey?: string;
    validate?: boolean;
    record?: unknown;
    swapRecord?: string;
    swapCommit?: string;
  };

  if (!repo || !collection || !rkey || !record) {
    return c.json({ error: 'InvalidRequest', message: 'repo, collection, rkey, and record required' }, 400);
  }

  // Validate collection name
  const collectionValidation = validateNsid(collection);
  if (!collectionValidation.valid) {
    return c.json({ error: 'InvalidRequest', message: collectionValidation.error }, 400);
  }

  // Validate rkey
  const rkeyValidation = validateRkey(rkey);
  if (!rkeyValidation.valid) {
    return c.json({ error: 'InvalidRequest', message: rkeyValidation.error }, 400);
  }

  if (repo !== session.did) {
    return c.json({ error: 'AuthRequired', message: 'Cannot write to another user\'s repo' }, 403);
  }

  const account = getPdsAccountByDid(session.did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Account not found' }, 404);
  }

  const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
  const repository = await getRepository(session.did, signingKey);

  try {
    // Check if record exists
    const existing = repository.getRecord(collection, rkey);

    let result;
    if (existing) {
      // Update with swap verification
      result = await repository.updateRecord(collection, rkey, record, swapRecord, swapCommit);
    } else {
      // Create new record (swapRecord should be null for create)
      if (swapRecord !== undefined && swapRecord !== null) {
        return c.json({ error: 'InvalidSwap', message: 'Record does not exist but swapRecord was provided' }, 400);
      }
      result = await repository.createRecord(collection, rkey, record, swapCommit);
    }

    // Track blob references
    const blobCids = extractBlobCids(record);
    for (const cid of blobCids) {
      addBlobReference(session.did, cid, result.uri);
    }

    return c.json({
      uri: result.uri,
      cid: result.cid.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to put record';
    if (message.includes('InvalidSwap')) {
      return c.json({ error: 'InvalidSwap', message }, 400);
    }
    return c.json({ error: 'InvalidRequest', message }, 400);
  }
}

/**
 * com.atproto.repo.deleteRecord
 * Delete a record
 */
export async function deleteRecordHandler(c: Context) {
  const session = requireAuth(c);
  if (!session) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const { repo, collection, rkey, swapRecord, swapCommit } = body as {
    repo?: string;
    collection?: string;
    rkey?: string;
    swapRecord?: string;
    swapCommit?: string;
  };

  if (!repo || !collection || !rkey) {
    return c.json({ error: 'InvalidRequest', message: 'repo, collection, and rkey required' }, 400);
  }

  // Validate collection name
  const collectionValidation = validateNsid(collection);
  if (!collectionValidation.valid) {
    return c.json({ error: 'InvalidRequest', message: collectionValidation.error }, 400);
  }

  // Validate rkey
  const rkeyValidation = validateRkey(rkey);
  if (!rkeyValidation.valid) {
    return c.json({ error: 'InvalidRequest', message: rkeyValidation.error }, 400);
  }

  if (repo !== session.did) {
    return c.json({ error: 'AuthRequired', message: 'Cannot write to another user\'s repo' }, 403);
  }

  const account = getPdsAccountByDid(session.did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Account not found' }, 404);
  }

  const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
  const repository = await getRepository(session.did, signingKey);

  try {
    // Delete with swap verification
    await repository.deleteRecord(collection, rkey, swapRecord, swapCommit);
    return c.json({});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete record';
    if (message.includes('InvalidSwap')) {
      return c.json({ error: 'InvalidSwap', message }, 400);
    }
    return c.json({ error: 'InvalidRequest', message }, 400);
  }
}

/**
 * com.atproto.repo.getRecord
 * Get a single record
 */
export async function getRecordHandler(c: Context) {
  const repo = c.req.query('repo');
  const collection = c.req.query('collection');
  const rkey = c.req.query('rkey');

  if (!repo || !collection || !rkey) {
    return c.json({ error: 'InvalidRequest', message: 'repo, collection, and rkey required' }, 400);
  }

  // Validate collection name
  const collectionValidation = validateNsid(collection);
  if (!collectionValidation.valid) {
    return c.json({ error: 'InvalidRequest', message: collectionValidation.error }, 400);
  }

  // Validate rkey
  const rkeyValidation = validateRkey(rkey);
  if (!rkeyValidation.valid) {
    return c.json({ error: 'InvalidRequest', message: rkeyValidation.error }, 400);
  }

  const did = repo.startsWith('did:') ? repo : null;
  if (!did) {
    return c.json({ error: 'InvalidRequest', message: 'Invalid repo identifier' }, 400);
  }

  const { account } = getPdsAccountByDidForRead(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
  const repository = await getRepository(did, signingKey);

  const record = repository.getRecord(collection, rkey);
  if (!record) {
    return c.json({ error: 'RecordNotFound', message: 'Record not found' }, 404);
  }

  return c.json({
    uri: record.uri,
    cid: record.cid,
    value: record.value,
  });
}

/**
 * com.atproto.repo.listRecords
 * List records in a collection
 */
export async function listRecordsHandler(c: Context) {
  const repo = c.req.query('repo');
  const collection = c.req.query('collection');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const cursor = c.req.query('cursor');
  const reverse = c.req.query('reverse') === 'true';

  if (!repo || !collection) {
    return c.json({ error: 'InvalidRequest', message: 'repo and collection required' }, 400);
  }

  // Validate collection name
  const collectionValidation = validateNsid(collection);
  if (!collectionValidation.valid) {
    return c.json({ error: 'InvalidRequest', message: collectionValidation.error }, 400);
  }

  const did = repo.startsWith('did:') ? repo : null;
  if (!did) {
    return c.json({ error: 'InvalidRequest', message: 'Invalid repo identifier' }, 400);
  }

  const { account } = getPdsAccountByDidForRead(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
  const repository = await getRepository(did, signingKey);

  const result = repository.listRecords(collection, {
    limit: Math.min(limit, 100),
    cursor,
    reverse,
  });

  return c.json({
    records: result.records.map(r => ({
      uri: r.uri,
      cid: r.cid,
      value: r.value,
    })),
    cursor: result.cursor,
  });
}

/**
 * com.atproto.repo.uploadBlob
 * Upload a blob (image, file, etc.)
 */
export async function uploadBlobHandler(c: Context) {
  const session = requireAuth(c);
  if (!session) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const contentType = c.req.header('Content-Type') || 'application/octet-stream';

  // Get the body as a buffer
  const body = await c.req.arrayBuffer();
  const data = Buffer.from(body);

  try {
    const result = await uploadBlob(session.did, data, contentType);

    return c.json({
      blob: result.ref,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload blob';
    return c.json({ error: 'InvalidRequest', message }, 400);
  }
}

/**
 * com.atproto.repo.applyWrites
 * Apply multiple write operations atomically
 */
export async function applyWritesHandler(c: Context) {
  const session = requireAuth(c);
  if (!session) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const { repo, validate, writes, swapCommit } = body as {
    repo?: string;
    validate?: boolean;
    writes?: Array<{
      $type: string;
      collection: string;
      rkey?: string;
      value?: unknown;
    }>;
    swapCommit?: string;
  };

  if (!repo || !writes || !Array.isArray(writes)) {
    return c.json({ error: 'InvalidRequest', message: 'repo and writes required' }, 400);
  }

  // Validate all writes before processing
  for (const write of writes) {
    const { collection, rkey } = write;

    // Validate collection name
    const collectionValidation = validateNsid(collection);
    if (!collectionValidation.valid) {
      return c.json({ error: 'InvalidRequest', message: collectionValidation.error }, 400);
    }

    // Validate rkey if provided
    if (rkey) {
      const rkeyValidation = validateRkey(rkey);
      if (!rkeyValidation.valid) {
        return c.json({ error: 'InvalidRequest', message: rkeyValidation.error }, 400);
      }
    }
  }

  if (repo !== session.did) {
    return c.json({ error: 'AuthRequired', message: 'Cannot write to another user\'s repo' }, 403);
  }

  const account = getPdsAccountByDid(session.did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Account not found' }, 404);
  }

  const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
  const repository = await getRepository(session.did, signingKey);

  const results: Array<{ uri: string; cid: string }> = [];

  try {
    for (const write of writes) {
      const { $type, collection, rkey, value } = write;

      switch ($type) {
        case 'com.atproto.repo.applyWrites#create': {
          const result = await repository.createRecord(collection, rkey, value);
          results.push({ uri: result.uri, cid: result.cid.toString() });
          break;
        }
        case 'com.atproto.repo.applyWrites#update': {
          if (!rkey) throw new Error('rkey required for update');
          const result = await repository.updateRecord(collection, rkey, value);
          results.push({ uri: result.uri, cid: result.cid.toString() });
          break;
        }
        case 'com.atproto.repo.applyWrites#delete': {
          if (!rkey) throw new Error('rkey required for delete');
          await repository.deleteRecord(collection, rkey);
          break;
        }
        default:
          throw new Error(`Unknown write type: ${$type}`);
      }
    }

    return c.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply writes';
    return c.json({ error: 'InvalidRequest', message }, 400);
  }
}
