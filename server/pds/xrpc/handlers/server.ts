/**
 * XRPC Handlers: com.atproto.server.*
 *
 * Account management and session endpoints.
 */

import type { Context } from 'hono';
import { Secp256k1Keypair } from '@atproto/crypto';
import { getPdsConfig } from '../../config.ts';
import { createKeyManager } from '../../identity/keys.ts';
import { createIdentity } from '../../identity/plc.ts';
import { generateUniqueHandle, resolveHandle } from '../../identity/handles.ts';
import {
  createSession,
  validateAccessToken,
  refreshSession,
  revokeSession,
  extractAccessToken,
} from '../../auth/session.ts';
import {
  createPdsAccount,
  getPdsAccountByDid,
  getPdsAccountBySocialId,
  getPdsAccountByHandle,
} from '../../database/queries.ts';
import { getRepository } from '../../repo/repository.ts';
import type { EncryptedKeyData } from '../../identity/keys.ts';

/**
 * com.atproto.server.describeServer
 * Returns server information and capabilities
 */
export async function describeServer(c: Context) {
  const config = getPdsConfig();

  return c.json({
    did: `did:web:${config.hostname}`,
    availableUserDomains: [config.handleDomain],
    inviteCodeRequired: false,
    phoneVerificationRequired: false,
    links: {
      privacyPolicy: `${config.publicUrl}/privacy`,
      termsOfService: `${config.publicUrl}/terms`,
    },
    contact: {},
  });
}

/**
 * com.atproto.server.createSession
 * Create a new authentication session
 */
export async function createSessionHandler(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const { identifier, password } = body as { identifier?: string; password?: string };

  // For now, we don't support password auth directly
  // Sessions are created via social login callback
  // This endpoint exists for ATProto compatibility

  if (!identifier) {
    return c.json({ error: 'InvalidRequest', message: 'Identifier required' }, 400);
  }

  // Try to find account by handle or DID
  let account = identifier.startsWith('did:')
    ? getPdsAccountByDid(identifier)
    : getPdsAccountByHandle(identifier);

  if (!account) {
    return c.json({ error: 'AuthenticationRequired', message: 'Invalid credentials' }, 401);
  }

  // For social login accounts, we can't verify password
  // This would need to be handled differently (e.g., app password support)
  return c.json({ error: 'AuthenticationRequired', message: 'Use social login to authenticate' }, 401);
}

/**
 * com.atproto.server.refreshSession
 * Refresh an authentication session
 */
export async function refreshSessionHandler(c: Context) {
  const authHeader = c.req.header('Authorization');
  const refreshJwt = extractAccessToken(authHeader);

  if (!refreshJwt) {
    return c.json({ error: 'InvalidToken', message: 'Refresh token required' }, 400);
  }

  const tokens = refreshSession(refreshJwt);
  if (!tokens) {
    return c.json({ error: 'ExpiredToken', message: 'Refresh token expired' }, 401);
  }

  const account = getPdsAccountByDid(
    // Parse DID from token (simplified)
    JSON.parse(Buffer.from(refreshJwt.split('.')[1], 'base64url').toString()).sub
  );

  if (!account) {
    return c.json({ error: 'InvalidToken', message: 'Account not found' }, 401);
  }

  return c.json({
    accessJwt: tokens.accessJwt,
    refreshJwt: tokens.refreshJwt,
    handle: account.handle,
    did: account.did,
  });
}

/**
 * com.atproto.server.getSession
 * Get the current session info
 */
export async function getSessionHandler(c: Context) {
  const authHeader = c.req.header('Authorization');
  const accessJwt = extractAccessToken(authHeader);

  if (!accessJwt) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const session = validateAccessToken(accessJwt);
  if (!session) {
    return c.json({ error: 'InvalidToken', message: 'Invalid or expired token' }, 401);
  }

  return c.json({
    handle: session.handle,
    did: session.did,
    email: session.email,
    emailConfirmed: true,
    emailAuthFactor: false,
  });
}

/**
 * com.atproto.server.deleteSession
 * Delete (logout) the current session
 */
export async function deleteSessionHandler(c: Context) {
  const authHeader = c.req.header('Authorization');
  const accessJwt = extractAccessToken(authHeader);

  if (accessJwt) {
    revokeSession(accessJwt);
  }

  return c.json({});
}

/**
 * com.atproto.server.createAccount
 * Create a new account (via social login)
 * Note: This is called after social login verification
 */
export async function createAccountHandler(
  socialProvider: 'github' | 'google',
  socialProviderId: string,
  email: string,
  suggestedUsername: string
) {
  const config = getPdsConfig();
  const keyManager = createKeyManager(config.keyEncryptionSecret);

  // Check if account already exists
  const existing = getPdsAccountBySocialId(socialProvider, socialProviderId);
  if (existing) {
    // Return existing account
    const tokens = createSession(existing.did);
    return {
      did: existing.did,
      handle: existing.handle,
      ...tokens,
    };
  }

  // Generate unique handle
  const handle = await generateUniqueHandle(suggestedUsername);

  // Generate keys
  const signingKey = await keyManager.generateSigningKey();
  const rotationKeys = await keyManager.generateRotationKeys(2);

  // Create did:plc identity
  const identity = await createIdentity({
    handle,
    signingKey: signingKey as Secp256k1Keypair,
    rotationKeys: rotationKeys as Secp256k1Keypair[],
  });

  // Store account in database
  const account = createPdsAccount(
    identity.did,
    handle,
    email,
    socialProvider,
    socialProviderId,
    identity.signingKey,
    identity.rotationKeys
  );

  // Initialize repository
  const repo = await getRepository(account.did, identity.signingKey);

  // Create session
  const tokens = createSession(account.did);

  return {
    did: account.did,
    handle: account.handle,
    ...tokens,
  };
}

/**
 * com.atproto.server.getAccountInviteCodes
 * Get invite codes (not implemented - no invite system)
 */
export async function getAccountInviteCodesHandler(c: Context) {
  return c.json({ codes: [] });
}

/**
 * com.atproto.server.requestPasswordReset
 * Request password reset (not applicable for social login)
 */
export async function requestPasswordResetHandler(c: Context) {
  return c.json({ error: 'NotSupported', message: 'Password reset not supported for social login accounts' }, 400);
}

/**
 * com.atproto.server.resetPassword
 * Reset password (not applicable for social login)
 */
export async function resetPasswordHandler(c: Context) {
  return c.json({ error: 'NotSupported', message: 'Password reset not supported for social login accounts' }, 400);
}

/**
 * Middleware to require authentication
 */
export function requireAuth(c: Context): { did: string; handle: string; email: string } | null {
  const authHeader = c.req.header('Authorization');
  const accessJwt = extractAccessToken(authHeader);

  if (!accessJwt) {
    return null;
  }

  return validateAccessToken(accessJwt);
}
