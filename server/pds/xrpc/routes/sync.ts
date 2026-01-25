/**
 * com.atproto.sync.* XRPC Routes
 * Synchronization endpoints for federation
 */

import type { Context } from 'hono';
import { xrpcError } from '../index.ts';
import { getRepository, repositoryExists } from '../../repo/index.ts';
import { getBlob, listBlobs } from '../../blob/index.ts';
import { getLatestSeq } from '../../firehose/index.ts';
import { getDatabase } from '../../../database/index.ts';

/**
 * com.atproto.sync.getRepo
 * Download repository as CAR file
 * Supports partial sync via `since` parameter (revision TID)
 */
export async function handleGetRepo(c: Context): Promise<Response> {
  const did = c.req.query('did');
  const since = c.req.query('since'); // For partial sync

  if (!did) {
    return xrpcError(c, 'InvalidRequest', 'did is required', 400);
  }

  if (!repositoryExists(did)) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  try {
    // If `since` is provided, do partial sync
    if (since) {
      const carData = await exportPartialRepo(did, since);
      if (!carData) {
        // No commits since the given revision
        return new Response(new Uint8Array(0), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.ipld.car',
          },
        });
      }

      return new Response(carData, {
        headers: {
          'Content-Type': 'application/vnd.ipld.car',
          'Content-Disposition': `attachment; filename="${did.replace(/:/g, '-')}-since-${since}.car"`,
        },
      });
    }

    // Full repo export
    const repository = getRepository(did);
    const carData = await repository.exportAsCAR();

    return new Response(carData, {
      headers: {
        'Content-Type': 'application/vnd.ipld.car',
        'Content-Disposition': `attachment; filename="${did.replace(/:/g, '-')}.car"`,
      },
    });
  } catch (error) {
    console.error('getRepo error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to export repository', 500);
  }
}

/**
 * Export partial repository since a specific revision
 * Uses firehose events which store CAR slices for each commit
 */
async function exportPartialRepo(did: string, since: string): Promise<Uint8Array | null> {
  const db = getDatabase();

  // Get all commits since the given revision
  // We compare revisions lexicographically since TIDs are designed to sort chronologically
  const events = db
    .prepare(
      `SELECT commit_cid, car_slice FROM firehose_events
       WHERE repo_did = ? AND event_type = 'commit' AND rev > ?
       ORDER BY rev ASC`
    )
    .all(did, since) as Array<{
    commit_cid: string;
    car_slice: Buffer | null;
  }>;

  if (events.length === 0) {
    return null;
  }

  // Get the latest commit CID as the root
  const latestCommitCid = events[events.length - 1].commit_cid;

  // Combine all CAR slices into a single CAR
  // First, decode all blocks from all CAR slices
  const { CarReader } = await import('@ipld/car');
  const { CarWriter } = await import('@ipld/car');
  const { CID } = await import('multiformats/cid');

  const allBlocks = new Map<string, { cid: any; bytes: Uint8Array }>();

  for (const event of events) {
    if (!event.car_slice) continue;

    try {
      const reader = await CarReader.fromBytes(new Uint8Array(event.car_slice));
      for await (const block of reader.blocks()) {
        allBlocks.set(block.cid.toString(), block);
      }
    } catch (error) {
      console.error('Error reading CAR slice:', error);
    }
  }

  if (allBlocks.size === 0) {
    return null;
  }

  // Write combined CAR with latest commit as root
  const rootCid = CID.parse(latestCommitCid);
  const { writer, out } = CarWriter.create([rootCid]);

  const chunks: Uint8Array[] = [];
  const reader = (async () => {
    for await (const chunk of out) {
      chunks.push(chunk);
    }
  })();

  for (const block of allBlocks.values()) {
    await writer.put(block);
  }
  await writer.close();
  await reader;

  // Concatenate chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * com.atproto.sync.getBlob
 * Download a blob by CID
 */
export async function handleGetBlob(c: Context): Promise<Response> {
  const did = c.req.query('did');
  const cid = c.req.query('cid');

  if (!did || !cid) {
    return xrpcError(c, 'InvalidRequest', 'did and cid are required', 400);
  }

  const blob = await getBlob(did, cid);

  if (!blob) {
    return xrpcError(c, 'BlobNotFound', 'Blob not found', 404);
  }

  return new Response(blob.data, {
    headers: {
      'Content-Type': blob.mimeType,
      'Content-Length': String(blob.data.length),
      // Security headers for blob serving
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

/**
 * com.atproto.sync.listBlobs
 * List all blobs for a repository
 * Supports `since` parameter to only list blobs created after a specific revision
 */
export async function handleListBlobs(c: Context): Promise<Response> {
  const did = c.req.query('did');
  const since = c.req.query('since');
  const limit = parseInt(c.req.query('limit') || '500', 10);
  const cursor = c.req.query('cursor');

  if (!did) {
    return xrpcError(c, 'InvalidRequest', 'did is required', 400);
  }

  if (!repositoryExists(did)) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  // If `since` parameter is provided, filter blobs by creation time
  // We need to find blobs that were added after the given revision
  if (since) {
    const db = getDatabase();

    // Find the timestamp of the `since` revision
    const revEvent = db
      .prepare(
        `SELECT created_at FROM firehose_events
         WHERE repo_did = ? AND rev = ? AND event_type = 'commit'
         LIMIT 1`
      )
      .get(did, since) as { created_at: string } | undefined;

    if (revEvent) {
      // List blobs created after that timestamp
      let query = `
        SELECT cid FROM repo_blobs
        WHERE repo_did = ? AND created_at > ?
      `;
      const params: (string | number)[] = [did, revEvent.created_at];

      if (cursor) {
        query += ' AND cid > ?';
        params.push(cursor);
      }

      query += ' ORDER BY cid ASC LIMIT ?';
      params.push(Math.min(limit, 1000) + 1);

      const rows = db.prepare(query).all(...params) as Array<{ cid: string }>;
      const hasMore = rows.length > limit;
      const results = rows.slice(0, limit);

      return c.json({
        cids: results.map((r) => r.cid),
        cursor: hasMore ? results[results.length - 1]?.cid : undefined,
      });
    }
  }

  // Default: list all blobs
  const result = listBlobs(did, { limit, cursor });

  return c.json({
    cids: result.blobs.map((b) => b.cid),
    cursor: result.cursor,
  });
}

/**
 * com.atproto.sync.getLatestCommit
 * Get the latest commit CID and revision
 */
export async function handleGetLatestCommit(c: Context): Promise<Response> {
  const did = c.req.query('did');

  if (!did) {
    return xrpcError(c, 'InvalidRequest', 'did is required', 400);
  }

  if (!repositoryExists(did)) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  const db = getDatabase();
  const state = db.prepare('SELECT head_cid, rev FROM repo_state WHERE did = ?').get(did) as
    | { head_cid: string; rev: string }
    | undefined;

  if (!state) {
    return xrpcError(c, 'RepoNotFound', 'Repository state not found', 404);
  }

  return c.json({
    cid: state.head_cid,
    rev: state.rev,
  });
}

/**
 * com.atproto.sync.subscribeRepos
 * WebSocket endpoint for firehose subscription
 * Note: This is handled separately via WebSocket, not as a regular HTTP endpoint
 */
export async function handleSubscribeRepos(c: Context): Promise<Response> {
  // This endpoint is a WebSocket endpoint and should be handled by the WebSocket server
  // Return an error for HTTP requests
  return xrpcError(
    c,
    'InvalidRequest',
    'subscribeRepos is a WebSocket endpoint. Connect via WebSocket.',
    400
  );
}

/**
 * com.atproto.sync.listRepos
 * List all repositories on this PDS
 */
export async function handleListRepos(c: Context): Promise<Response> {
  const limit = parseInt(c.req.query('limit') || '500', 10);
  const cursor = c.req.query('cursor');

  const db = getDatabase();

  let query = `
    SELECT u.did, u.handle, rs.head_cid, rs.rev
    FROM users u
    JOIN repo_state rs ON u.did = rs.did
    WHERE u.auth_type = 'social'
  `;

  const params: (string | number)[] = [];

  if (cursor) {
    query += ' AND u.did > ?';
    params.push(cursor);
  }

  query += ' ORDER BY u.did ASC LIMIT ?';
  params.push(Math.min(limit, 1000));

  const rows = db.prepare(query).all(...params) as Array<{
    did: string;
    handle: string;
    head_cid: string;
    rev: string;
  }>;

  return c.json({
    repos: rows.map((r) => ({
      did: r.did,
      head: r.head_cid,
      rev: r.rev,
      active: true,
    })),
    cursor: rows.length > 0 ? rows[rows.length - 1].did : undefined,
  });
}

/**
 * com.atproto.sync.getRepoStatus
 * Get repository sync status
 */
export async function handleGetRepoStatus(c: Context): Promise<Response> {
  const did = c.req.query('did');

  if (!did) {
    return xrpcError(c, 'InvalidRequest', 'did is required', 400);
  }

  if (!repositoryExists(did)) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  const db = getDatabase();
  const state = db.prepare('SELECT head_cid, rev FROM repo_state WHERE did = ?').get(did) as
    | { head_cid: string; rev: string }
    | undefined;

  return c.json({
    did,
    active: true,
    status: state ? 'active' : 'deactivated',
    rev: state?.rev,
  });
}
