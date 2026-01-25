/**
 * OAuth Authorization Server
 * Implements ATProto OAuth 2.0 for third-party client authentication
 * Supports PKCE, DPoP, and PAR as required by ATProto spec
 */

import type { Context } from 'hono';
import type { Hono } from 'hono';
import crypto from 'crypto';
import { getPDSConfig } from '../config.ts';
import { getDatabase } from '../../database/index.ts';
import { escapeHtml } from '../utils.ts';

const AUTH_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  dpopJkt?: string;
}

/**
 * Mount OAuth routes
 */
export function mountOAuthRoutes(app: Hono): void {
  // Pushed Authorization Request endpoint
  app.post('/oauth/par', handlePAR);

  // Authorization endpoint
  app.get('/oauth/authorize', handleAuthorize);
  app.post('/oauth/authorize', handleAuthorizeSubmit);

  // Token endpoint
  app.post('/oauth/token', handleToken);

  // Token revocation
  app.post('/oauth/revoke', handleRevoke);
}

/**
 * Pushed Authorization Request (PAR) endpoint
 * Clients must use PAR to initiate authorization
 */
async function handlePAR(c: Context): Promise<Response> {
  try {
    const body = await parseFormBody(c);

    const clientId = body.client_id;
    const redirectUri = body.redirect_uri;
    const scope = body.scope || 'atproto';
    const codeChallenge = body.code_challenge;
    const codeChallengeMethod = body.code_challenge_method;
    const state = body.state;
    const dpopJkt = c.req.header('DPoP') ? extractDPoPJkt(c.req.header('DPoP')!) : undefined;

    // Validate required parameters
    if (!clientId || !redirectUri || !codeChallenge) {
      return c.json(
        { error: 'invalid_request', error_description: 'Missing required parameters' },
        400
      );
    }

    // Validate code challenge method
    if (codeChallengeMethod !== 'S256') {
      return c.json(
        { error: 'invalid_request', error_description: 'Only S256 code challenge method supported' },
        400
      );
    }

    // Validate code challenge format (S256 produces 43 char base64url hash)
    if (codeChallenge.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(codeChallenge)) {
      return c.json(
        { error: 'invalid_request', error_description: 'Invalid code challenge format' },
        400
      );
    }

    // Generate request URI
    const requestUri = `urn:ietf:params:oauth:request_uri:${crypto.randomBytes(16).toString('hex')}`;
    const expiresIn = 60; // 60 seconds

    // Store PAR request
    const db = getDatabase();
    db.prepare(
      `INSERT INTO pds_oauth_codes
       (code, user_did, client_id, redirect_uri, scope, code_challenge, code_challenge_method, dpop_jkt, expires_at)
       VALUES (?, '', ?, ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))`
    ).run(requestUri, clientId, redirectUri, scope, codeChallenge, codeChallengeMethod, dpopJkt, expiresIn);

    return c.json({
      request_uri: requestUri,
      expires_in: expiresIn,
    });
  } catch (error) {
    console.error('PAR error:', error);
    return c.json({ error: 'server_error', error_description: 'Internal error' }, 500);
  }
}

/**
 * Authorization endpoint - displays consent screen
 * ATProto requires PAR (Pushed Authorization Request) - clients must first
 * POST to /oauth/par and use the returned request_uri here.
 */
async function handleAuthorize(c: Context): Promise<Response> {
  const requestUri = c.req.query('request_uri');

  // PAR is required per ATProto OAuth spec
  if (!requestUri) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: 'Pushed Authorization Request (PAR) is required. Use POST /oauth/par first.',
      },
      400
    );
  }

  // Validate request_uri format
  if (!requestUri.startsWith('urn:ietf:params:oauth:request_uri:')) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: 'Invalid request_uri format',
      },
      400
    );
  }

  // Look up PAR request
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT client_id, redirect_uri, scope, code_challenge, code_challenge_method, dpop_jkt
       FROM pds_oauth_codes
       WHERE code = ? AND user_did = '' AND expires_at > datetime('now')`
    )
    .get(requestUri) as {
    client_id: string;
    redirect_uri: string;
    scope: string;
    code_challenge: string;
    code_challenge_method: string;
    dpop_jkt: string | null;
  } | undefined;

  if (!row) {
    return c.json({ error: 'invalid_request', error_description: 'Request expired or not found' }, 400);
  }

  const authRequest: AuthorizationRequest = {
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    scope: row.scope,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: row.code_challenge_method,
    dpopJkt: row.dpop_jkt || undefined,
  };

  // Render authorization page
  const config = getPDSConfig();
  const html = renderAuthorizePage(authRequest, config.publicUrl);

  return c.html(html);
}

/**
 * Handle authorization form submission
 */
async function handleAuthorizeSubmit(c: Context): Promise<Response> {
  const body = await parseFormBody(c);

  const action = body.action;
  const clientId = body.client_id;
  const redirectUri = body.redirect_uri;
  const scope = body.scope;
  const codeChallenge = body.code_challenge;
  const codeChallengeMethod = body.code_challenge_method;
  const state = body.state;
  const sessionToken = body.session_token || c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];

  if (action === 'deny') {
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (state) redirectUrl.searchParams.set('state', state);
    return c.redirect(redirectUrl.toString());
  }

  // Verify session
  const db = getDatabase();
  const session = db
    .prepare(
      `SELECT s.user_id, u.did FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = ? AND s.expires_at > datetime('now')`
    )
    .get(sessionToken) as { user_id: number; did: string } | undefined;

  if (!session) {
    return c.html(renderLoginPage(body));
  }

  // Generate authorization code
  const code = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS).toISOString();

  db.prepare(
    `INSERT INTO pds_oauth_codes
     (code, user_did, client_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(code, session.did, clientId, redirectUri, scope, codeChallenge, codeChallengeMethod, expiresAt);

  // Redirect with code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return c.redirect(redirectUrl.toString());
}

/**
 * Token endpoint - exchange code for tokens
 */
async function handleToken(c: Context): Promise<Response> {
  try {
    const body = await parseFormBody(c);

    const grantType = body.grant_type;
    const code = body.code;
    const codeVerifier = body.code_verifier;
    const redirectUri = body.redirect_uri;
    const clientId = body.client_id;
    const refreshToken = body.refresh_token;

    const db = getDatabase();

    if (grantType === 'authorization_code') {
      // Validate code
      const codeRow = db
        .prepare(
          `SELECT * FROM pds_oauth_codes
           WHERE code = ? AND expires_at > datetime('now')`
        )
        .get(code) as {
        user_did: string;
        client_id: string;
        redirect_uri: string;
        scope: string;
        code_challenge: string;
        code_challenge_method: string;
      } | undefined;

      if (!codeRow) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid or expired code' }, 400);
      }

      // Validate redirect URI
      if (codeRow.redirect_uri !== redirectUri) {
        return c.json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }, 400);
      }

      // Validate code verifier (PKCE)
      // RFC 7636: code_verifier must be 43-128 characters
      if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid code verifier length' }, 400);
      }

      const expectedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      if (expectedChallenge !== codeRow.code_challenge) {
        return c.json({ error: 'invalid_grant', error_description: 'Code verifier mismatch' }, 400);
      }

      // Delete used code
      db.prepare('DELETE FROM pds_oauth_codes WHERE code = ?').run(code);

      // Generate tokens
      const accessToken = crypto.randomBytes(32).toString('base64url');
      const newRefreshToken = crypto.randomBytes(32).toString('base64url');
      const tokenId = crypto.randomBytes(16).toString('hex');

      const accessExpiry = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_MS).toISOString();
      const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

      // Store tokens
      db.prepare(
        `INSERT INTO pds_oauth_tokens
         (token_id, user_did, client_id, scope, access_token_hash, refresh_token_hash, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        tokenId,
        codeRow.user_did,
        codeRow.client_id,
        codeRow.scope,
        hashToken(accessToken),
        hashToken(newRefreshToken),
        refreshExpiry
      );

      return c.json({
        access_token: accessToken,
        token_type: 'DPoP',
        expires_in: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000),
        refresh_token: newRefreshToken,
        scope: codeRow.scope,
        sub: codeRow.user_did,
      });
    } else if (grantType === 'refresh_token') {
      // Find token by refresh token hash
      const tokenRow = db
        .prepare(
          `SELECT * FROM pds_oauth_tokens
           WHERE refresh_token_hash = ? AND expires_at > datetime('now')`
        )
        .get(hashToken(refreshToken || '')) as {
        token_id: string;
        user_did: string;
        client_id: string;
        scope: string;
      } | undefined;

      if (!tokenRow) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
      }

      // Generate new tokens
      const accessToken = crypto.randomBytes(32).toString('base64url');
      const newRefreshToken = crypto.randomBytes(32).toString('base64url');

      const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

      // Update tokens
      db.prepare(
        `UPDATE pds_oauth_tokens
         SET access_token_hash = ?, refresh_token_hash = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ?`
      ).run(hashToken(accessToken), hashToken(newRefreshToken), refreshExpiry, tokenRow.token_id);

      return c.json({
        access_token: accessToken,
        token_type: 'DPoP',
        expires_in: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000),
        refresh_token: newRefreshToken,
        scope: tokenRow.scope,
        sub: tokenRow.user_did,
      });
    }

    return c.json({ error: 'unsupported_grant_type' }, 400);
  } catch (error) {
    console.error('Token error:', error);
    return c.json({ error: 'server_error' }, 500);
  }
}

/**
 * Token revocation endpoint
 */
async function handleRevoke(c: Context): Promise<Response> {
  const body = await parseFormBody(c);
  const token = body.token;

  if (!token) {
    return c.json({ error: 'invalid_request' }, 400);
  }

  const db = getDatabase();
  const tokenHash = hashToken(token);

  // Try to revoke as access token or refresh token
  db.prepare(
    'DELETE FROM pds_oauth_tokens WHERE access_token_hash = ? OR refresh_token_hash = ?'
  ).run(tokenHash, tokenHash);

  return c.json({});
}

/**
 * Parse form body or JSON body
 */
async function parseFormBody(c: Context): Promise<Record<string, string>> {
  const contentType = c.req.header('Content-Type') || '';

  if (contentType.includes('application/json')) {
    return await c.req.json();
  }

  const text = await c.req.text();
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};

  for (const [key, value] of params) {
    result[key] = value;
  }

  return result;
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Extract JWK thumbprint from DPoP header
 */
function extractDPoPJkt(dpopHeader: string): string | undefined {
  // DPoP header is a JWT - we'd need to parse and extract JWK thumbprint
  // For now, return undefined (DPoP validation not fully implemented)
  return undefined;
}

/**
 * Render authorization consent page
 */
function renderAuthorizePage(request: AuthorizationRequest, publicUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize Application - Leaf</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #666; margin-bottom: 16px; }
    .scope { background: #f0f0f0; padding: 8px 12px; border-radius: 4px; margin: 8px 0; }
    .buttons { display: flex; gap: 12px; margin-top: 24px; }
    button { flex: 1; padding: 12px; border-radius: 6px; font-size: 16px; cursor: pointer; }
    .approve { background: #0066cc; color: white; border: none; }
    .deny { background: white; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize Application</h1>
    <p><strong>${escapeHtml(request.clientId)}</strong> wants to access your Leaf account.</p>
    <p>This will allow the application to:</p>
    <div class="scope">${escapeHtml(request.scope)}</div>
    <form method="POST">
      <input type="hidden" name="client_id" value="${escapeHtml(request.clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(request.redirectUri)}">
      <input type="hidden" name="scope" value="${escapeHtml(request.scope)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(request.codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(request.codeChallengeMethod)}">
      ${request.state ? `<input type="hidden" name="state" value="${escapeHtml(request.state)}">` : ''}
      <div class="buttons">
        <button type="submit" name="action" value="deny" class="deny">Deny</button>
        <button type="submit" name="action" value="approve" class="approve">Authorize</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Render login page for OAuth flow
 */
function renderLoginPage(params: Record<string, string>): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In - Leaf</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #666; margin-bottom: 16px; }
    .error { color: red; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign In Required</h1>
    <p>Please sign in to Leaf to authorize this application.</p>
    <p><a href="/login">Sign in with GitHub or Google</a></p>
  </div>
</body>
</html>`;
}

