/**
 * com.atproto.server.* XRPC Routes
 * Server management endpoints
 */

import type { Context } from 'hono';
import crypto from 'crypto';
import { getPDSConfig } from '../../config.ts';
import { xrpcError, verifyAuth } from '../index.ts';
import { getAvailableProviders } from '../../social-auth/index.ts';
import { getDatabase } from '../../../database/index.ts';
import { SESSION_EXPIRY_MS } from '../../../utils/constants.ts';

/**
 * com.atproto.server.describeServer
 * Returns server metadata and capabilities
 */
export async function handleDescribeServer(c: Context): Promise<Response> {
  const config = getPDSConfig();
  const providers = getAvailableProviders();

  return c.json({
    did: config.serviceDid,
    availableUserDomains: [config.handleDomain],
    inviteCodeRequired: false,
    phoneVerificationRequired: false,
    links: {
      privacyPolicy: `${config.publicUrl}/privacy`,
      termsOfService: `${config.publicUrl}/terms`,
    },
    contact: {
      email: process.env.CONTACT_EMAIL || undefined,
    },
    // Custom extension: available social login providers
    socialLoginProviders: providers,
  });
}

/**
 * com.atproto.server.createSession
 * Create a session with identifier and password (app password)
 */
export async function handleCreateSession(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return xrpcError(c, 'InvalidRequest', 'identifier and password are required', 400);
    }

    const db = getDatabase();
    const config = getPDSConfig();

    // Find user by handle or DID
    let user;
    if (identifier.startsWith('did:')) {
      user = db.prepare('SELECT * FROM users WHERE did = ?').get(identifier);
    } else {
      const handle = identifier.startsWith('@') ? identifier.slice(1) : identifier;
      user = db.prepare('SELECT * FROM users WHERE handle = ? OR handle = ?').get(handle, `@${handle}`);
    }

    if (!user) {
      return xrpcError(c, 'AuthenticationRequired', 'Invalid identifier or password', 401);
    }

    const typedUser = user as {
      id: number;
      did: string;
      handle: string;
      display_name: string | null;
      auth_type: string;
      signing_key: string;
    };

    // For social auth users, we don't support app passwords currently
    // They must use OAuth or session tokens
    if (typedUser.auth_type === 'social') {
      return xrpcError(
        c,
        'InvalidRequest',
        'Social login users should use OAuth. App passwords are not supported.',
        400
      );
    }

    // For ATProto users, delegate to their PDS
    // This shouldn't happen for our PDS-hosted users
    return xrpcError(c, 'InvalidRequest', 'Use OAuth for authentication', 400);
  } catch (error) {
    console.error('createSession error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to create session', 500);
  }
}

/**
 * com.atproto.server.refreshSession
 * Refresh an existing session
 */
export async function handleRefreshSession(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);

  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Invalid or expired session', 401);
  }

  const db = getDatabase();

  // Get user info
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.userId) as {
    did: string;
    handle: string;
    display_name: string | null;
  };

  if (!user) {
    return xrpcError(c, 'AuthenticationRequired', 'User not found', 401);
  }

  // Generate new session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();

  // Update session
  db.prepare(
    `UPDATE sessions SET session_token = ?, expires_at = ? WHERE user_id = ?`
  ).run(sessionToken, expiresAt, auth.userId);

  return c.json({
    did: user.did,
    handle: user.handle,
    // For social users, we return the session token as the access token
    // Real ATProto would use JWTs
    accessJwt: sessionToken,
    refreshJwt: sessionToken,
    active: true,
  });
}

/**
 * com.atproto.server.deleteSession
 * Delete/logout the current session
 */
export async function handleDeleteSession(c: Context): Promise<Response> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return xrpcError(c, 'AuthenticationRequired', 'Authorization required', 401);
  }

  const token = authHeader.slice(7);
  const db = getDatabase();

  db.prepare('DELETE FROM sessions WHERE session_token = ?').run(token);

  return c.json({});
}

/**
 * com.atproto.server.getSession
 * Get information about the current session
 */
export async function handleGetSession(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);

  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Invalid or expired session', 401);
  }

  const db = getDatabase();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.userId) as {
    did: string;
    handle: string;
    display_name: string | null;
    pds_url: string;
  };

  if (!user) {
    return xrpcError(c, 'AuthenticationRequired', 'User not found', 401);
  }

  return c.json({
    did: user.did,
    handle: user.handle,
    email: undefined, // We don't expose email
    emailConfirmed: false,
    emailAuthFactor: false,
    didDoc: undefined, // Could include DID document
    active: true,
  });
}

/**
 * Create a session for a social login user
 * This is called internally after OAuth callback
 */
export function createSocialUserSession(userId: number): {
  sessionToken: string;
  expiresAt: string;
} {
  const db = getDatabase();
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();

  db.prepare(
    `INSERT INTO sessions (user_id, session_token, expires_at)
     VALUES (?, ?, ?)`
  ).run(userId, sessionToken, expiresAt);

  return { sessionToken, expiresAt };
}
