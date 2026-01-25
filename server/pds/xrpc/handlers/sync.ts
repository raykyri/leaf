/**
 * XRPC Handlers: com.atproto.sync.*
 *
 * Repository synchronization endpoints.
 */

import type { Context } from 'hono';
import { exportRepoCar, getRepoHead, repoExists } from '../../repo/car.ts';
import { getBlob, listBlobsForDid } from '../../repo/blobs.ts';
import { getPdsAccountByDid, getLatestPdsCommit, getPdsCommitsSince } from '../../database/queries.ts';

/**
 * com.atproto.sync.getRepo
 * Get the full repository as a CAR file
 */
export async function getRepoHandler(c: Context) {
  const did = c.req.query('did');
  const since = c.req.query('since');

  if (!did) {
    return c.json({ error: 'InvalidRequest', message: 'did parameter required' }, 400);
  }

  const account = getPdsAccountByDid(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  try {
    const carData = await exportRepoCar(did, since);

    return new Response(carData, {
      headers: {
        'Content-Type': 'application/vnd.ipld.car',
        'Content-Disposition': `attachment; filename="${did}.car"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export repository';
    return c.json({ error: 'InternalError', message }, 500);
  }
}

/**
 * com.atproto.sync.getLatestCommit
 * Get the latest commit for a repository
 */
export async function getLatestCommitHandler(c: Context) {
  const did = c.req.query('did');

  if (!did) {
    return c.json({ error: 'InvalidRequest', message: 'did parameter required' }, 400);
  }

  const account = getPdsAccountByDid(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  const head = getRepoHead(did);
  if (!head) {
    return c.json({ error: 'RepoNotFound', message: 'No commits found' }, 404);
  }

  return c.json({
    cid: head.root,
    rev: head.rev,
  });
}

/**
 * com.atproto.sync.getRepoStatus
 * Get the status of a repository
 */
export async function getRepoStatusHandler(c: Context) {
  const did = c.req.query('did');

  if (!did) {
    return c.json({ error: 'InvalidRequest', message: 'did parameter required' }, 400);
  }

  const account = getPdsAccountByDid(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  const exists = repoExists(did);
  const head = exists ? getRepoHead(did) : null;

  return c.json({
    did,
    active: account.deactivated_at === null,
    status: account.deactivated_at ? 'deactivated' : 'active',
    rev: head?.rev,
  });
}

/**
 * com.atproto.sync.getBlob
 * Get a blob by CID
 */
export async function getBlobHandler(c: Context) {
  const did = c.req.query('did');
  const cid = c.req.query('cid');

  if (!did || !cid) {
    return c.json({ error: 'InvalidRequest', message: 'did and cid parameters required' }, 400);
  }

  const blob = getBlob(cid);
  if (!blob) {
    return c.json({ error: 'BlobNotFound', message: 'Blob not found' }, 404);
  }

  return new Response(blob.data, {
    headers: {
      'Content-Type': blob.mimeType,
      'Content-Length': blob.size.toString(),
    },
  });
}

/**
 * com.atproto.sync.listBlobs
 * List blobs in a repository
 */
export async function listBlobsHandler(c: Context) {
  const did = c.req.query('did');
  const since = c.req.query('since');
  const limit = parseInt(c.req.query('limit') || '500', 10);
  const cursor = c.req.query('cursor');

  if (!did) {
    return c.json({ error: 'InvalidRequest', message: 'did parameter required' }, 400);
  }

  const account = getPdsAccountByDid(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  const result = listBlobsForDid(did, {
    limit: Math.min(limit, 1000),
    cursor,
  });

  return c.json({
    cids: result.blobs.map(b => b.cid),
    cursor: result.cursor,
  });
}

/**
 * com.atproto.sync.getRecord
 * Get a single record as a CAR file
 */
export async function getRecordHandler(c: Context) {
  const did = c.req.query('did');
  const collection = c.req.query('collection');
  const rkey = c.req.query('rkey');

  if (!did || !collection || !rkey) {
    return c.json({ error: 'InvalidRequest', message: 'did, collection, and rkey parameters required' }, 400);
  }

  // For now, redirect to the regular getRecord endpoint
  // A full implementation would return the record as CAR
  return c.json({ error: 'NotImplemented', message: 'Use com.atproto.repo.getRecord instead' }, 501);
}

/**
 * com.atproto.sync.getBlocks
 * Get specific blocks by CID
 */
export async function getBlocksHandler(c: Context) {
  const did = c.req.query('did');
  const cids = c.req.queries('cids') || [];

  if (!did || cids.length === 0) {
    return c.json({ error: 'InvalidRequest', message: 'did and cids parameters required' }, 400);
  }

  // This would return the blocks as CAR
  // For now, not fully implemented
  return c.json({ error: 'NotImplemented', message: 'Block retrieval not implemented' }, 501);
}

/**
 * com.atproto.sync.getCheckout
 * Get a checkout of the repository
 * Deprecated in favor of getRepo
 */
export async function getCheckoutHandler(c: Context) {
  // Redirect to getRepo
  return getRepoHandler(c);
}

/**
 * com.atproto.sync.listRepos
 * List all repositories on this PDS
 */
export async function listReposHandler(c: Context) {
  const limit = parseInt(c.req.query('limit') || '500', 10);
  const cursor = c.req.query('cursor');

  // This would list all repos on the PDS
  // For now, return empty (would need to implement proper pagination)
  return c.json({
    repos: [],
    cursor: undefined,
  });
}

/**
 * com.atproto.sync.notifyOfUpdate
 * Notify that a repository has been updated
 */
export async function notifyOfUpdateHandler(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const { hostname } = body as { hostname?: string };

  // This is for relay coordination, acknowledge but no action needed
  return c.json({});
}

/**
 * com.atproto.sync.requestCrawl
 * Request a crawl of this PDS
 */
export async function requestCrawlHandler(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const { hostname } = body as { hostname?: string };

  // This is for relay coordination, acknowledge
  return c.json({});
}
