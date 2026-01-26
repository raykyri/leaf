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
import {
  exportAccount,
  generateMigrationToken,
  importAccount,
  validateAccountExport,
  type AccountExport,
} from '../../migration/index.ts';

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

// ============================================================================
// Account Migration Endpoints
// ============================================================================

/**
 * com.atproto.server.exportAccountData
 * Export account data for migration to another PDS
 */
export async function exportAccountDataHandler(c: Context) {
  const auth = requireAuth(c);
  if (!auth) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const includeBlobs = c.req.query('includeBlobs') === 'true';
  const reEncryptionSecret = c.req.query('reEncryptionSecret');

  try {
    const result = await exportAccount(auth.did, {
      includeBlobs,
      reEncryptionSecret: reEncryptionSecret || undefined,
    });

    // Return metadata as JSON, CAR files as separate endpoints
    return c.json({
      metadata: result.metadata,
      repoCarSize: result.repoCarData.length,
      blobCarSize: result.blobCarData?.length || 0,
    });
  } catch (error) {
    return c.json(
      { error: 'InternalError', message: error instanceof Error ? error.message : 'Export failed' },
      500
    );
  }
}

/**
 * com.atproto.server.exportAccountRepo
 * Export account repository as CAR file
 */
export async function exportAccountRepoHandler(c: Context) {
  const auth = requireAuth(c);
  if (!auth) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  try {
    const result = await exportAccount(auth.did, { includeBlobs: false });

    return new Response(result.repoCarData, {
      headers: {
        'Content-Type': 'application/vnd.ipld.car',
        'Content-Disposition': `attachment; filename="${auth.did.replace(/:/g, '_')}_repo.car"`,
      },
    });
  } catch (error) {
    return c.json(
      { error: 'InternalError', message: error instanceof Error ? error.message : 'Export failed' },
      500
    );
  }
}

/**
 * com.atproto.server.exportAccountBlobs
 * Export account blobs as CAR file
 */
export async function exportAccountBlobsHandler(c: Context) {
  const auth = requireAuth(c);
  if (!auth) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  try {
    const result = await exportAccount(auth.did, { includeBlobs: true });

    if (!result.blobCarData) {
      return c.json({ error: 'NotFound', message: 'No blobs to export' }, 404);
    }

    return new Response(result.blobCarData, {
      headers: {
        'Content-Type': 'application/vnd.ipld.car',
        'Content-Disposition': `attachment; filename="${auth.did.replace(/:/g, '_')}_blobs.car"`,
      },
    });
  } catch (error) {
    return c.json(
      { error: 'InternalError', message: error instanceof Error ? error.message : 'Export failed' },
      500
    );
  }
}

/**
 * com.atproto.server.generateMigrationToken
 * Generate a signed migration token for account transfer
 */
export async function generateMigrationTokenHandler(c: Context) {
  const auth = requireAuth(c);
  if (!auth) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const { targetPds } = body as { targetPds?: string };

  if (!targetPds) {
    return c.json({ error: 'InvalidRequest', message: 'targetPds is required' }, 400);
  }

  try {
    const token = await generateMigrationToken(auth.did, targetPds);
    return c.json({ token });
  } catch (error) {
    return c.json(
      { error: 'InternalError', message: error instanceof Error ? error.message : 'Token generation failed' },
      500
    );
  }
}

/**
 * com.atproto.server.importAccount
 * Import an account from another PDS
 */
export async function importAccountHandler(c: Context) {
  const contentType = c.req.header('Content-Type');

  if (!contentType?.includes('multipart/form-data')) {
    return c.json({ error: 'InvalidRequest', message: 'multipart/form-data required' }, 400);
  }

  try {
    const formData = await c.req.formData();

    // Get metadata
    const metadataStr = formData.get('metadata');
    if (!metadataStr || typeof metadataStr !== 'string') {
      return c.json({ error: 'InvalidRequest', message: 'metadata is required' }, 400);
    }

    const metadata = JSON.parse(metadataStr) as AccountExport;

    // Validate metadata
    const validation = validateAccountExport(metadata);
    if (!validation.valid) {
      return c.json(
        { error: 'InvalidRequest', message: validation.errors.join(', ') },
        400
      );
    }

    // Get repository CAR
    const repoCar = formData.get('repoCar');
    if (!repoCar || !(repoCar instanceof File)) {
      return c.json({ error: 'InvalidRequest', message: 'repoCar file is required' }, 400);
    }
    const repoCarData = new Uint8Array(await repoCar.arrayBuffer());

    // Get blob CAR (optional)
    const blobCar = formData.get('blobCar');
    let blobCarData: Uint8Array | undefined;
    if (blobCar instanceof File) {
      blobCarData = new Uint8Array(await blobCar.arrayBuffer());
    }

    // Get options
    const migrationToken = formData.get('migrationToken');
    const reEncryptionSecret = formData.get('reEncryptionSecret');
    const skipDidUpdate = formData.get('skipDidUpdate') === 'true';
    const forceHandleChange = formData.get('forceHandleChange') === 'true';

    // Import the account
    const result = await importAccount(metadata, repoCarData, blobCarData, {
      migrationToken: typeof migrationToken === 'string' ? migrationToken : undefined,
      reEncryptionSecret: typeof reEncryptionSecret === 'string' ? reEncryptionSecret : undefined,
      skipDidUpdate,
      forceHandleChange,
    });

    // Create session for imported account
    const tokens = createSession(result.did);

    return c.json({
      ...result,
      accessJwt: tokens.accessJwt,
      refreshJwt: tokens.refreshJwt,
    });
  } catch (error) {
    return c.json(
      { error: 'InternalError', message: error instanceof Error ? error.message : 'Import failed' },
      500
    );
  }
}

/**
 * com.atproto.server.checkAccountStatus
 * Check if an account can be migrated to this PDS
 */
export async function checkAccountStatusHandler(c: Context) {
  const did = c.req.query('did');
  const handle = c.req.query('handle');

  if (!did && !handle) {
    return c.json({ error: 'InvalidRequest', message: 'did or handle required' }, 400);
  }

  // Check if account already exists
  const existingByDid = did ? getPdsAccountByDid(did) : null;
  const existingByHandle = handle ? getPdsAccountByHandle(handle) : null;

  return c.json({
    didAvailable: !existingByDid,
    handleAvailable: !existingByHandle,
    canImport: !existingByDid,
    warnings: existingByHandle ? ['Handle is already taken on this PDS'] : [],
  });
}
