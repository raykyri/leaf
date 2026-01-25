/**
 * XRPC Server
 * Implements ATProto XRPC endpoints for the custom PDS
 */

import type { Context } from 'hono';
import type { Hono } from 'hono';
import { getPDSConfig, isPDSEnabled } from '../config.ts';

// Import route handlers
import { handleDescribeServer, handleCreateSession, handleRefreshSession, handleDeleteSession, handleGetSession } from './routes/server.ts';
import { handleCreateRecord, handleGetRecord, handleListRecords, handleDeleteRecord, handlePutRecord, handleApplyWrites, handleDescribeRepo, handleUploadBlob } from './routes/repo.ts';
import { handleGetRepo, handleGetBlob, handleListBlobs, handleGetLatestCommit, handleSubscribeRepos, handleListRepos, handleGetRepoStatus } from './routes/sync.ts';
import { handleResolveHandle, handleUpdateHandle, handleGetRecommendedDidCredentials, handleSignPlcOperation, handleSubmitPlcOperation, handleRequestPlcOperationSignature } from './routes/identity.ts';

/**
 * Mount XRPC routes on Hono app
 */
export function mountXRPCRoutes(app: Hono): void {
  if (!isPDSEnabled()) {
    console.log('PDS not enabled (no social auth configured)');
    return;
  }

  const config = getPDSConfig();
  console.log(`Mounting XRPC routes for PDS at ${config.publicUrl}`);

  // Server endpoints
  app.get('/xrpc/com.atproto.server.describeServer', handleDescribeServer);
  app.post('/xrpc/com.atproto.server.createSession', handleCreateSession);
  app.post('/xrpc/com.atproto.server.refreshSession', handleRefreshSession);
  app.post('/xrpc/com.atproto.server.deleteSession', handleDeleteSession);
  app.get('/xrpc/com.atproto.server.getSession', handleGetSession);

  // Repository endpoints
  app.post('/xrpc/com.atproto.repo.createRecord', handleCreateRecord);
  app.get('/xrpc/com.atproto.repo.getRecord', handleGetRecord);
  app.get('/xrpc/com.atproto.repo.listRecords', handleListRecords);
  app.post('/xrpc/com.atproto.repo.deleteRecord', handleDeleteRecord);
  app.post('/xrpc/com.atproto.repo.putRecord', handlePutRecord);
  app.post('/xrpc/com.atproto.repo.applyWrites', handleApplyWrites);
  app.get('/xrpc/com.atproto.repo.describeRepo', handleDescribeRepo);
  app.post('/xrpc/com.atproto.repo.uploadBlob', handleUploadBlob);

  // Sync endpoints
  app.get('/xrpc/com.atproto.sync.getRepo', handleGetRepo);
  app.get('/xrpc/com.atproto.sync.getBlob', handleGetBlob);
  app.get('/xrpc/com.atproto.sync.listBlobs', handleListBlobs);
  app.get('/xrpc/com.atproto.sync.getLatestCommit', handleGetLatestCommit);
  app.get('/xrpc/com.atproto.sync.listRepos', handleListRepos);
  app.get('/xrpc/com.atproto.sync.getRepoStatus', handleGetRepoStatus);
  // WebSocket endpoint handled separately

  // Identity endpoints
  app.get('/xrpc/com.atproto.identity.resolveHandle', handleResolveHandle);
  app.post('/xrpc/com.atproto.identity.updateHandle', handleUpdateHandle);
  app.get('/xrpc/com.atproto.identity.getRecommendedDidCredentials', handleGetRecommendedDidCredentials);
  app.post('/xrpc/com.atproto.identity.signPlcOperation', handleSignPlcOperation);
  app.post('/xrpc/com.atproto.identity.submitPlcOperation', handleSubmitPlcOperation);
  app.post('/xrpc/com.atproto.identity.requestPlcOperationSignature', handleRequestPlcOperationSignature);

  // Well-known endpoints for OAuth and identity
  app.get('/.well-known/atproto-did', handleAtProtoDid);
  app.get('/.well-known/oauth-authorization-server', handleOAuthServerMetadata);
  app.get('/.well-known/oauth-protected-resource', handleOAuthResourceMetadata);

  // DID document endpoint for did:web
  app.get('/user/:suffix', handleDidWebDocument);
}

/**
 * Handle /.well-known/atproto-did
 */
async function handleAtProtoDid(c: Context): Promise<Response> {
  const config = getPDSConfig();
  return c.text(config.serviceDid);
}

/**
 * Handle OAuth authorization server metadata
 */
async function handleOAuthServerMetadata(c: Context): Promise<Response> {
  const config = getPDSConfig();

  return c.json({
    issuer: config.publicUrl,
    authorization_endpoint: `${config.publicUrl}/oauth/authorize`,
    token_endpoint: `${config.publicUrl}/oauth/token`,
    pushed_authorization_request_endpoint: `${config.publicUrl}/oauth/par`,
    require_pushed_authorization_requests: true,
    dpop_signing_alg_values_supported: ['ES256'],
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    response_types_supported: ['code'],
    scopes_supported: ['atproto', 'transition:generic', 'transition:chat.bsky'],
    client_id_metadata_document_supported: true,
    token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
    subject_types_supported: ['public'],
  });
}

/**
 * Handle OAuth protected resource metadata
 */
async function handleOAuthResourceMetadata(c: Context): Promise<Response> {
  const config = getPDSConfig();

  return c.json({
    resource: config.publicUrl,
    authorization_servers: [config.publicUrl],
    scopes_supported: ['atproto', 'transition:generic'],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://atproto.com/specs/oauth',
  });
}

/**
 * Handle DID document for did:web
 */
async function handleDidWebDocument(c: Context): Promise<Response> {
  const suffix = c.req.param('suffix');
  const config = getPDSConfig();

  const { getDatabase } = await import('../../database/index.ts');
  const db = getDatabase();

  // Find user with matching DID
  const did = `did:web:${config.hostname}:user:${suffix}`;
  const user = db.prepare('SELECT * FROM users WHERE did = ?').get(did) as {
    did: string;
    handle: string;
    signing_key: string;
  } | undefined;

  if (!user) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Get signing key DID
  const { decryptKeyPair } = await import('../crypto/keys.ts');
  let signingKeyDid: string;
  try {
    const exported = decryptKeyPair(user.signing_key, config.jwtSecret);
    signingKeyDid = exported.did;
  } catch {
    return c.json({ error: 'Internal error' }, 500);
  }

  const { generateDIDDocument } = await import('../identity/index.ts');
  const didDoc = generateDIDDocument(user.did, user.handle, signingKeyDid);

  return c.json(didDoc, 200, {
    'Content-Type': 'application/did+ld+json',
  });
}

/**
 * Create XRPC error response
 */
export function xrpcError(c: Context, error: string, message: string, status: number = 400): Response {
  return c.json(
    {
      error,
      message,
    },
    status as 400 | 401 | 403 | 404 | 500 | 501
  );
}

/**
 * Verify authorization header and return user DID
 */
export async function verifyAuth(c: Context): Promise<{ did: string; userId: number } | null> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  // Try to verify as our session token first
  const { getDatabase } = await import('../../database/index.ts');
  const db = getDatabase();

  // Check if it's a session token
  const session = db
    .prepare(
      `SELECT s.user_id, u.did FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = ? AND s.expires_at > datetime('now')`
    )
    .get(token) as { user_id: number; did: string } | undefined;

  if (session) {
    return { did: session.did, userId: session.user_id };
  }

  // TODO: Verify as JWT token for OAuth flow
  // This would involve verifying the JWT signature and DPoP proof

  return null;
}
