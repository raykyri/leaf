/**
 * com.atproto.identity.* XRPC Routes
 * Identity management endpoints
 */

import type { Context } from 'hono';
import { xrpcError, verifyAuth } from '../index.ts';
import { resolveHandle, updateHandle as updateHandleIdentity } from '../../identity/index.ts';
import { getPDSConfig } from '../../config.ts';
import { getDatabase } from '../../../database/index.ts';

/**
 * com.atproto.identity.resolveHandle
 * Resolve a handle to a DID
 */
export async function handleResolveHandle(c: Context): Promise<Response> {
  const handle = c.req.query('handle');

  if (!handle) {
    return xrpcError(c, 'InvalidRequest', 'handle is required', 400);
  }

  const did = await resolveHandle(handle);

  if (!did) {
    return xrpcError(c, 'HandleNotFound', 'Handle not found', 404);
  }

  return c.json({ did });
}

/**
 * com.atproto.identity.updateHandle
 * Update the authenticated user's handle
 */
export async function handleUpdateHandle(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  try {
    const body = await c.req.json();
    const { handle } = body;

    if (!handle) {
      return xrpcError(c, 'InvalidRequest', 'handle is required', 400);
    }

    // Validate handle format
    const config = getPDSConfig();
    if (!isValidHandle(handle, config.handleDomain)) {
      return xrpcError(c, 'InvalidHandle', 'Invalid handle format', 400);
    }

    // Update handle
    const success = await updateHandleIdentity(auth.did, handle);

    if (!success) {
      return xrpcError(c, 'HandleNotAvailable', 'Handle is not available', 400);
    }

    return c.json({});
  } catch (error) {
    console.error('updateHandle error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to update handle', 500);
  }
}

/**
 * Validate handle format
 */
function isValidHandle(handle: string, domain: string): boolean {
  // Handle must be lowercase
  if (handle !== handle.toLowerCase()) {
    return false;
  }

  // Handle must end with our domain or be a custom domain
  if (!handle.endsWith(`.${domain}`) && !handle.includes('.')) {
    return false;
  }

  // Handle parts must be valid
  const parts = handle.split('.');
  for (const part of parts) {
    // Each part must be 1-63 characters
    if (part.length < 1 || part.length > 63) {
      return false;
    }
    // Must start and end with alphanumeric
    if (!/^[a-z0-9]/.test(part) || !/[a-z0-9]$/.test(part)) {
      return false;
    }
    // Can only contain alphanumeric and hyphens
    if (!/^[a-z0-9-]+$/.test(part)) {
      return false;
    }
    // No consecutive hyphens
    if (part.includes('--')) {
      return false;
    }
  }

  // Total handle must be <= 253 characters
  if (handle.length > 253) {
    return false;
  }

  // Must have at least 2 parts
  if (parts.length < 2) {
    return false;
  }

  return true;
}

/**
 * com.atproto.identity.getRecommendedDidCredentials
 * Get recommended credentials for a DID operation
 */
export async function handleGetRecommendedDidCredentials(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  const db = getDatabase();
  const user = db.prepare('SELECT signing_key FROM users WHERE id = ?').get(auth.userId) as {
    signing_key: string;
  } | undefined;

  if (!user || !user.signing_key) {
    return xrpcError(c, 'InternalServerError', 'No signing key found', 500);
  }

  // Decrypt and get public key
  const config = getPDSConfig();
  const { decryptKeyPair } = await import('../../crypto/keys.ts');

  try {
    const exported = decryptKeyPair(user.signing_key, config.jwtSecret);

    return c.json({
      rotationKeys: [exported.did],
      alsoKnownAs: [],
      verificationMethods: {
        atproto: exported.did,
      },
      services: {},
    });
  } catch (error) {
    console.error('Failed to get credentials:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to get credentials', 500);
  }
}

/**
 * com.atproto.identity.signPlcOperation
 * Sign a PLC operation (for advanced identity management)
 */
export async function handleSignPlcOperation(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  // This would be used for advanced PLC operations like key rotation
  // For now, return not implemented
  return xrpcError(c, 'NotImplemented', 'PLC operations not yet supported', 501);
}

/**
 * com.atproto.identity.submitPlcOperation
 * Submit a signed PLC operation
 */
export async function handleSubmitPlcOperation(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  // This would submit a signed operation to the PLC directory
  // For now, return not implemented
  return xrpcError(c, 'NotImplemented', 'PLC operations not yet supported', 501);
}
