/**
 * XRPC Handlers: com.atproto.identity.*
 *
 * Identity and handle resolution endpoints.
 */

import type { Context } from 'hono';
import { getPdsConfig } from '../../config.ts';
import { requireAuth } from './server.ts';
import { resolveHandle, validateHandle, isHandleAvailable, isLocalHandle } from '../../identity/handles.ts';
import { resolveDid, updateHandle as updatePlcHandle, loadRotationKeys } from '../../identity/plc.ts';
import { getPdsAccountByDid, getPdsAccountByHandle, updatePdsAccountHandle } from '../../database/queries.ts';
import type { EncryptedKeyData } from '../../identity/keys.ts';

/**
 * com.atproto.identity.resolveHandle
 * Resolve a handle to a DID
 */
export async function resolveHandleHandler(c: Context) {
  const handle = c.req.query('handle');

  if (!handle) {
    return c.json({ error: 'InvalidRequest', message: 'handle parameter required' }, 400);
  }

  // Check if it's a local handle
  if (isLocalHandle(handle)) {
    const did = resolveHandle(handle);
    if (did) {
      return c.json({ did });
    }
  }

  // For non-local handles, we could try to resolve via external means
  // For now, return not found
  return c.json({ error: 'HandleNotFound', message: 'Handle not found' }, 404);
}

/**
 * com.atproto.identity.updateHandle
 * Update the handle for the authenticated user
 */
export async function updateHandleHandler(c: Context) {
  const session = requireAuth(c);
  if (!session) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const { handle } = body as { handle?: string };

  if (!handle) {
    return c.json({ error: 'InvalidRequest', message: 'handle parameter required' }, 400);
  }

  // Validate handle format
  const validation = validateHandle(handle);
  if (!validation.valid) {
    return c.json({ error: 'InvalidHandle', message: validation.error }, 400);
  }

  // Check if handle is available
  const available = await isHandleAvailable(handle);
  if (!available) {
    return c.json({ error: 'HandleNotAvailable', message: 'Handle is already taken' }, 400);
  }

  // Get account
  const account = getPdsAccountByDid(session.did);
  if (!account) {
    return c.json({ error: 'AccountNotFound', message: 'Account not found' }, 404);
  }

  try {
    // Update handle in PLC directory
    const rotationKeys = JSON.parse(account.rotation_keys) as EncryptedKeyData[];
    const keys = await loadRotationKeys(rotationKeys);

    await updatePlcHandle(session.did, handle, keys[0]);

    // Update handle in local database
    updatePdsAccountHandle(session.did, handle);

    return c.json({});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update handle';
    return c.json({ error: 'InternalError', message }, 500);
  }
}

/**
 * com.atproto.identity.getRecommendedDidCredentials
 * Get recommended DID credentials for account creation
 */
export async function getRecommendedDidCredentialsHandler(c: Context) {
  const config = getPdsConfig();

  return c.json({
    rotationKeys: [], // User would generate these
    alsoKnownAs: [],
    verificationMethods: {},
    services: {
      atproto_pds: {
        type: 'AtprotoPersonalDataServer',
        endpoint: config.publicUrl,
      },
    },
  });
}

/**
 * com.atproto.identity.signPlcOperation
 * Sign a PLC operation for the authenticated user
 */
export async function signPlcOperationHandler(c: Context) {
  const session = requireAuth(c);
  if (!session) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  // This endpoint allows signing arbitrary PLC operations
  // For security, we only support specific operation types
  const body = await c.req.json().catch(() => ({}));
  const { token, rotationKeys, alsoKnownAs, verificationMethods, services } = body as {
    token?: string;
    rotationKeys?: string[];
    alsoKnownAs?: string[];
    verificationMethods?: Record<string, unknown>;
    services?: Record<string, unknown>;
  };

  // For now, only support handle updates through the dedicated endpoint
  return c.json({
    error: 'NotSupported',
    message: 'Use com.atproto.identity.updateHandle for handle changes',
  }, 400);
}

/**
 * com.atproto.identity.submitPlcOperation
 * Submit a signed PLC operation
 */
export async function submitPlcOperationHandler(c: Context) {
  // This would forward a signed operation to PLC directory
  // For security, we don't support arbitrary operations
  return c.json({
    error: 'NotSupported',
    message: 'Direct PLC operation submission not supported',
  }, 400);
}

/**
 * com.atproto.identity.requestPlcOperationSignature
 * Request a signature for a PLC operation
 */
export async function requestPlcOperationSignatureHandler(c: Context) {
  const session = requireAuth(c);
  if (!session) {
    return c.json({ error: 'AuthRequired', message: 'Authentication required' }, 401);
  }

  // This would send an email with a token for PLC operations
  // For social login accounts, we handle this differently
  return c.json({
    error: 'NotSupported',
    message: 'Email-based PLC operation signing not supported for social login accounts',
  }, 400);
}

/**
 * Serve .well-known/atproto-did for handle resolution
 */
export async function serveAtprotoDid(c: Context) {
  const config = getPdsConfig();
  const host = c.req.header('Host');

  if (!host) {
    return c.text('', 404);
  }

  // The host should be the handle
  const handle = host.split(':')[0]; // Remove port if present

  // Check if this is a handle on our domain
  if (!handle.endsWith(`.${config.handleDomain}`)) {
    return c.text('', 404);
  }

  const did = resolveHandle(handle);
  if (!did) {
    return c.text('', 404);
  }

  return c.text(did, 200, {
    'Content-Type': 'text/plain',
  });
}
