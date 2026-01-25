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
 */
export async function handleGetRepo(c: Context): Promise<Response> {
  const did = c.req.query('did');
  const since = c.req.query('since'); // For partial sync (not implemented)

  if (!did) {
    return xrpcError(c, 'InvalidRequest', 'did is required', 400);
  }

  if (!repositoryExists(did)) {
    return xrpcError(c, 'RepoNotFound', 'Repository not found', 404);
  }

  try {
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
