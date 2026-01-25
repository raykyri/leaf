/**
 * com.atproto.identity.* XRPC Routes
 * Identity management endpoints
 */

import type { Context } from 'hono';
import { xrpcError, verifyAuth } from '../index.ts';
import { resolveHandle, updateHandle as updateHandleIdentity } from '../../identity/index.ts';
import { getPDSConfig } from '../../config.ts';
import { getDatabase } from '../../../database/index.ts';
import { isValidHandle } from '../../utils.ts';

/**
 * com.atproto.identity.resolveHandle
 * Resolve a handle to a DID
 */
export async function handleResolveHandle(c: Context): Promise<Response> {
  const handle = c.req.query('handle');

  if (!handle) {
    return xrpcError(c, 'InvalidRequest', 'handle is required', 400);
  }

  // Validate handle format
  if (!isValidHandle(handle)) {
    return xrpcError(c, 'InvalidHandle', 'Invalid handle format', 400);
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
    if (!isValidHandle(handle)) {
      return xrpcError(c, 'InvalidHandle', 'Invalid handle format', 400);
    }

    // Check if handle is on our domain or a custom domain
    const config = getPDSConfig();
    const isOurDomain = handle.endsWith(`.${config.handleDomain}`);

    // For custom domains, we'd need to verify ownership via DNS/HTTP
    // For now, only allow handles on our domain
    if (!isOurDomain) {
      return xrpcError(c, 'InvalidHandle', 'Only handles on our domain are currently supported', 400);
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
 * Sign a PLC operation with the user's rotation key
 * This allows key rotation, handle changes, and PDS migration
 */
export async function handleSignPlcOperation(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  try {
    const body = await c.req.json();
    const { token, operation } = body;

    // Require a token or pre-authenticated session
    if (!token && !auth.did) {
      return xrpcError(c, 'InvalidRequest', 'Missing token or authentication', 400);
    }

    // Validate operation structure
    if (!operation || typeof operation !== 'object') {
      return xrpcError(c, 'InvalidRequest', 'Missing or invalid operation', 400);
    }

    // Get user's rotation key
    const db = getDatabase();
    const config = getPDSConfig();
    const user = db.prepare('SELECT rotation_key, did FROM users WHERE id = ?').get(auth.userId) as {
      rotation_key: string;
      did: string;
    } | undefined;

    if (!user || !user.rotation_key) {
      return xrpcError(c, 'InvalidRequest', 'No rotation key found for user', 400);
    }

    // Decrypt rotation key
    const { decryptKeyPair, sign, importKeyPair } = await import('../../crypto/keys.ts');
    const exportedKey = decryptKeyPair(user.rotation_key, config.jwtSecret);
    const rotationKey = await importKeyPair(exportedKey);

    // Get current PLC state to set prev
    let prev: string | null = null;
    try {
      const plcResponse = await fetch(`${config.plcDirectoryUrl}/${user.did}/log/last`);
      if (plcResponse.ok) {
        const lastOp = await plcResponse.json() as { cid: string };
        prev = lastOp.cid;
      }
    } catch {
      // No previous operation (genesis) or PLC unavailable
    }

    // Build the operation to sign
    // @ts-ignore - dag-cbor types
    const cbor = await import('@ipld/dag-cbor');
    const { sha256 } = await import('multiformats/hashes/sha2');
    const { CID } = await import('multiformats/cid');

    const unsignedOp = {
      ...operation,
      prev,
    };

    // Remove any existing signature
    delete (unsignedOp as Record<string, unknown>).sig;

    // Encode and sign
    const opBytes = cbor.encode(unsignedOp);
    const signature = await sign(rotationKey, opBytes);

    // Create signed operation
    const signedOp = {
      ...unsignedOp,
      sig: Buffer.from(signature).toString('base64url'),
    };

    return c.json({
      operation: signedOp,
    });
  } catch (error) {
    console.error('signPlcOperation error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to sign operation', 500);
  }
}

/**
 * com.atproto.identity.submitPlcOperation
 * Submit a signed PLC operation to the PLC directory
 */
export async function handleSubmitPlcOperation(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  try {
    const body = await c.req.json();
    const { operation } = body;

    if (!operation || typeof operation !== 'object') {
      return xrpcError(c, 'InvalidRequest', 'Missing or invalid operation', 400);
    }

    // Verify the operation has a signature
    if (!operation.sig) {
      return xrpcError(c, 'InvalidRequest', 'Operation must be signed', 400);
    }

    // Submit to PLC directory
    const config = getPDSConfig();
    const response = await fetch(`${config.plcDirectoryUrl}/${auth.did}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(operation),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('PLC submission failed:', error);
      return xrpcError(c, 'UpstreamFailure', `PLC directory rejected operation: ${error}`, 502);
    }

    // Update local state based on operation type
    const db = getDatabase();

    // If the operation changed the handle, update locally
    if (operation.alsoKnownAs && Array.isArray(operation.alsoKnownAs)) {
      const handle = operation.alsoKnownAs.find((aka: string) => aka.startsWith('at://'));
      if (handle) {
        const newHandle = handle.replace('at://', '');
        db.prepare('UPDATE users SET handle = ? WHERE did = ?').run(newHandle, auth.did);
      }
    }

    // If operation changed signing key, update locally
    if (operation.verificationMethods?.atproto) {
      // The signing key was rotated - user may need to re-authenticate
      console.log(`Signing key rotated for ${auth.did}`);
    }

    // If operation changed PDS service, this is a migration
    if (operation.services?.atproto_pds?.endpoint) {
      const newPdsEndpoint = operation.services.atproto_pds.endpoint;
      if (newPdsEndpoint !== config.publicUrl) {
        console.log(`User ${auth.did} migrating to ${newPdsEndpoint}`);
        // Mark account as migrated (don't delete data immediately)
        db.prepare('UPDATE users SET auth_type = ? WHERE did = ?').run('migrated', auth.did);
      }
    }

    return c.json({});
  } catch (error) {
    console.error('submitPlcOperation error:', error);
    return xrpcError(c, 'InternalServerError', 'Failed to submit operation', 500);
  }
}

/**
 * com.atproto.identity.requestPlcOperationSignature
 * Request the PDS to send a PLC operation signature email
 * (For account recovery scenarios)
 */
export async function handleRequestPlcOperationSignature(c: Context): Promise<Response> {
  const auth = await verifyAuth(c);
  if (!auth) {
    return xrpcError(c, 'AuthenticationRequired', 'Authentication required', 401);
  }

  // For social login users, we could send a verification to their email
  // For now, return success (signature request acknowledged)
  // In production, this would trigger an email with a signed token

  return c.json({});
}
