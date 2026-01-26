/**
 * XRPC Handlers: com.atproto.sync.*
 *
 * Repository synchronization endpoints.
 */

import type { Context } from 'hono';
import { CID } from 'multiformats/cid';
import { CarWriter } from '@ipld/car';
import { exportRepoCar, exportRecordCar, getRepoHead, repoExists } from '../../repo/car.ts';
import { getBlob, listBlobsForDid } from '../../repo/blobs.ts';
import { getRepository } from '../../repo/repository.ts';
import {
  getPdsAccountByDid,
  getPdsAccountByDidForRead,
  getLatestPdsCommit,
  getPdsCommitsSince,
  getPdsCommitByCid,
  getPdsRecord,
  listPdsRepos,
} from '../../database/queries.ts';
import type { EncryptedKeyData } from '../../identity/keys.ts';

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

  const { account } = getPdsAccountByDidForRead(did);
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

  const { account } = getPdsAccountByDidForRead(did);
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

  const { account, deactivated } = getPdsAccountByDidForRead(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  const exists = repoExists(did);
  const head = exists ? getRepoHead(did) : null;

  return c.json({
    did,
    active: !deactivated,
    status: deactivated ? 'deactivated' : 'active',
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

  const { account } = getPdsAccountByDidForRead(did);
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
  const commit = c.req.query('commit');

  if (!did || !collection || !rkey) {
    return c.json({ error: 'InvalidRequest', message: 'did, collection, and rkey parameters required' }, 400);
  }

  const { account } = getPdsAccountByDidForRead(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  // Get the record
  const record = getPdsRecord(did, collection, rkey);
  if (!record) {
    return c.json({ error: 'RecordNotFound', message: 'Record not found' }, 404);
  }

  try {
    // Export as CAR file
    const carData = await exportRecordCar(did, collection, rkey);
    if (!carData) {
      return c.json({ error: 'RecordNotFound', message: 'Record not found' }, 404);
    }

    return new Response(carData, {
      headers: {
        'Content-Type': 'application/vnd.ipld.car',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export record';
    return c.json({ error: 'InternalError', message }, 500);
  }
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

  const { account } = getPdsAccountByDidForRead(did);
  if (!account) {
    return c.json({ error: 'RepoNotFound', message: 'Repository not found' }, 404);
  }

  try {
    // Get the repository manager
    const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
    const repository = await getRepository(did, signingKey);

    // Collect requested blocks
    const blocks: Array<{ cid: CID; bytes: Uint8Array }> = [];

    for (const cidStr of cids) {
      // Try to find in commits first
      const commit = getPdsCommitByCid(cidStr);
      if (commit) {
        blocks.push({
          cid: CID.parse(cidStr),
          bytes: new Uint8Array(commit.data),
        });
        continue;
      }

      // Try to find in repository blocks
      const block = repository.getBlock(cidStr);
      if (block) {
        blocks.push(block);
      }
    }

    if (blocks.length === 0) {
      return c.json({ error: 'BlocksNotFound', message: 'No blocks found' }, 404);
    }

    // Create CAR file with the blocks
    const chunks: Uint8Array[] = [];
    const { writer, out } = CarWriter.create(blocks.map(b => b.cid));

    // Collect output
    const collectPromise = (async () => {
      for await (const chunk of out) {
        chunks.push(chunk);
      }
    })();

    // Write blocks
    for (const block of blocks) {
      await writer.put(block);
    }

    await writer.close();
    await collectPromise;

    // Concatenate chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const carData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      carData.set(chunk, offset);
      offset += chunk.length;
    }

    return new Response(carData, {
      headers: {
        'Content-Type': 'application/vnd.ipld.car',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get blocks';
    return c.json({ error: 'InternalError', message }, 500);
  }
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

  // Get paginated list of repos with state
  const result = listPdsRepos({
    limit: Math.min(limit, 1000),
    cursor: cursor || undefined,
  });

  return c.json({
    repos: result.repos,
    cursor: result.cursor,
  });
}

/**
 * com.atproto.sync.notifyOfUpdate
 * Notify that a repository has been updated
 */
export async function notifyOfUpdateHandler(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const { hostname } = body as { hostname?: string };

  // This is for relay coordination
  // In a full implementation, we would:
  // 1. Validate the requesting relay
  // 2. Queue the repository for crawl
  // 3. Return acknowledgment

  // For now, acknowledge the request
  return c.json({});
}

/**
 * com.atproto.sync.requestCrawl
 * Request a crawl of this PDS
 */
export async function requestCrawlHandler(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const { hostname } = body as { hostname?: string };

  // This is for relay coordination
  // In a full implementation, we would:
  // 1. Validate the requesting relay
  // 2. Add the relay to our list of subscribers
  // 3. Initiate firehose connection or notify of updates

  // For now, acknowledge the request
  return c.json({});
}
