/**
 * PDS Session Management
 *
 * Handles JWT-based sessions for PDS accounts.
 */

import crypto from 'crypto';
import { getPdsConfig } from '../config.ts';
import {
  createPdsSession,
  getPdsSessionByAccessToken,
  getPdsSessionByRefreshToken,
  deletePdsSession,
  deletePdsSessionsByDid,
  deleteExpiredPdsSessions,
  getPdsAccountByDid,
  type PdsAccount,
} from '../database/queries.ts';
import { hashToken } from '../identity/keys.ts';

// Token expiry times
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionTokens {
  accessJwt: string;
  refreshJwt: string;
}

export interface SessionInfo {
  did: string;
  handle: string;
  email: string;
}

/**
 * Generate a simple JWT-like token
 * Note: This is a simplified implementation. In production, consider using jose or jsonwebtoken.
 */
function generateToken(payload: object, secret: string, expiresInMs: number): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + expiresInMs) / 1000);

  const claims = {
    ...payload,
    iat: now,
    exp,
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify and decode a JWT token
 */
function verifyToken(token: string, secret: string): { payload: Record<string, unknown>; valid: boolean; expired: boolean } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { payload: {}, valid: false, expired: false };
    }

    const [headerB64, payloadB64, signature] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { payload: {}, valid: false, expired: false };
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as Record<string, unknown>;

    // Check expiry
    const exp = payload.exp as number;
    if (exp && exp < Math.floor(Date.now() / 1000)) {
      return { payload, valid: false, expired: true };
    }

    return { payload, valid: true, expired: false };
  } catch {
    return { payload: {}, valid: false, expired: false };
  }
}

/**
 * Create a new session for a DID
 */
export function createSession(did: string): SessionTokens {
  const config = getPdsConfig();

  // Generate access and refresh tokens
  const accessJwt = generateToken(
    { sub: did, scope: 'access' },
    config.jwtSecret,
    ACCESS_TOKEN_EXPIRY_MS
  );

  const refreshJwt = generateToken(
    { sub: did, scope: 'refresh' },
    config.jwtSecret,
    REFRESH_TOKEN_EXPIRY_MS
  );

  // Store session in database (hash tokens for storage)
  const accessTokenHash = hashToken(accessJwt);
  const refreshTokenHash = hashToken(refreshJwt);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  createPdsSession(did, accessTokenHash, refreshTokenHash, expiresAt);

  return { accessJwt, refreshJwt };
}

/**
 * Validate an access token and return session info
 */
export function validateAccessToken(accessJwt: string): SessionInfo | null {
  const config = getPdsConfig();

  // Verify JWT
  const { payload, valid, expired } = verifyToken(accessJwt, config.jwtSecret);

  if (!valid) {
    return null;
  }

  if (expired) {
    return null;
  }

  const did = payload.sub as string;
  const scope = payload.scope as string;

  if (scope !== 'access' || !did) {
    return null;
  }

  // Verify session exists in database
  const accessTokenHash = hashToken(accessJwt);
  const session = getPdsSessionByAccessToken(accessTokenHash);

  if (!session) {
    return null;
  }

  // Get account info
  const account = getPdsAccountByDid(did);
  if (!account) {
    return null;
  }

  return {
    did: account.did,
    handle: account.handle,
    email: account.email,
  };
}

/**
 * Refresh a session using a refresh token
 */
export function refreshSession(refreshJwt: string): SessionTokens | null {
  const config = getPdsConfig();

  // Verify JWT
  const { payload, valid, expired } = verifyToken(refreshJwt, config.jwtSecret);

  if (!valid && !expired) {
    return null;
  }

  const did = payload.sub as string;
  const scope = payload.scope as string;

  if (scope !== 'refresh' || !did) {
    return null;
  }

  // Verify session exists in database
  const refreshTokenHash = hashToken(refreshJwt);
  const session = getPdsSessionByRefreshToken(refreshTokenHash);

  if (!session) {
    return null;
  }

  // Check if refresh token itself is expired (beyond grace period)
  const refreshExpiry = new Date(session.expires_at);
  if (refreshExpiry < new Date()) {
    // Clean up expired session
    deletePdsSession(session.access_token_hash);
    return null;
  }

  // Delete old session and create new one
  deletePdsSession(session.access_token_hash);

  return createSession(did);
}

/**
 * Revoke a session
 */
export function revokeSession(accessJwt: string): void {
  const accessTokenHash = hashToken(accessJwt);
  deletePdsSession(accessTokenHash);
}

/**
 * Revoke all sessions for a DID
 */
export function revokeAllSessions(did: string): void {
  deletePdsSessionsByDid(did);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): void {
  deleteExpiredPdsSessions();
}

/**
 * Extract access token from Authorization header
 */
export function extractAccessToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get session info from an account
 */
export function getSessionInfo(account: PdsAccount): SessionInfo {
  return {
    did: account.did,
    handle: account.handle,
    email: account.email,
  };
}
