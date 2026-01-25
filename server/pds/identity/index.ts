/**
 * Identity Layer
 * Handles DID:PLC creation, handle management, and DID document serving
 */

import { getPDSConfig } from '../config.ts';
import { type KeyPair, exportKeyPair } from '../crypto/keys.ts';
import { type SocialUserInfo } from '../social-auth/providers.ts';

export interface DIDDocument {
  '@context': string[];
  id: string;
  alsoKnownAs: string[];
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase: string;
  }>;
  service: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

export interface PLCOperation {
  type: 'plc_operation';
  rotationKeys: string[];
  verificationMethods: {
    atproto: string;
  };
  alsoKnownAs: string[];
  services: {
    atproto_pds: {
      type: string;
      endpoint: string;
    };
  };
  prev: string | null;
  sig?: string;
}

/**
 * Create a new DID:PLC for a user
 * Registers with the PLC directory
 */
export async function createDid(
  signingKey: KeyPair,
  rotationKey: KeyPair,
  handle: string
): Promise<string> {
  const config = getPDSConfig();

  // Build the PLC operation (genesis operation)
  const operation: PLCOperation = {
    type: 'plc_operation',
    rotationKeys: [rotationKey.did],
    verificationMethods: {
      atproto: signingKey.did,
    },
    alsoKnownAs: [`at://${handle}`],
    services: {
      atproto_pds: {
        type: 'AtprotoPersonalDataServer',
        endpoint: config.publicUrl,
      },
    },
    prev: null,
  };

  // For now, we'll create a deterministic DID based on the genesis operation
  // In production, this would be submitted to the PLC directory
  // The PLC directory would compute the DID from the signed genesis operation

  // For development/testing, we can use did:web as a fallback
  if (process.env.NODE_ENV === 'development' || !process.env.PLC_SUBMIT_ENABLED) {
    // Use did:web for development
    const didSuffix = generateDidSuffix(signingKey);
    const did = `did:web:${config.hostname}:user:${didSuffix}`;
    console.log(`Created development DID: ${did}`);
    return did;
  }

  // Submit to PLC directory (production)
  return submitToPLCDirectory(operation, rotationKey);
}

/**
 * Generate a deterministic DID suffix from signing key
 */
function generateDidSuffix(signingKey: KeyPair): string {
  // Use first 16 chars of public key multibase as suffix
  return signingKey.publicKeyMultibase.slice(0, 24).replace(/[^a-z0-9]/gi, '');
}

/**
 * Submit a PLC operation to the directory
 */
async function submitToPLCDirectory(
  operation: PLCOperation,
  rotationKey: KeyPair
): Promise<string> {
  const config = getPDSConfig();

  // Sign the operation with rotation key
  const { sign } = await import('../crypto/keys.ts');
  const { CID } = await import('multiformats/cid');
  const { sha256 } = await import('multiformats/hashes/sha2');
  // @ts-ignore - @ipld/dag-cbor types not resolving correctly
  const cbor = await import('@ipld/dag-cbor');

  // Encode operation without signature
  const unsignedOp = { ...operation };
  delete unsignedOp.sig;
  const encoded = cbor.encode(unsignedOp) as Uint8Array;

  // Sign with rotation key
  const signature = await sign(rotationKey, encoded);
  const signedOp = {
    ...operation,
    sig: Buffer.from(signature).toString('base64url'),
  };

  // Submit to PLC directory
  const response = await fetch(`${config.plcDirectoryUrl}/did:plc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(signedOp),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PLC directory submission failed: ${error}`);
  }

  const result = await response.json() as { did: string };
  return result.did;
}

/**
 * Generate DID document for a user
 */
export function generateDIDDocument(
  did: string,
  handle: string,
  signingKeyDid: string
): DIDDocument {
  const config = getPDSConfig();

  return {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/multikey/v1',
      'https://w3id.org/security/suites/secp256k1-2019/v1',
    ],
    id: did,
    alsoKnownAs: [`at://${handle}`],
    verificationMethod: [
      {
        id: `${did}#atproto`,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase: signingKeyDid.replace('did:key:', ''),
      },
    ],
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: config.publicUrl,
      },
    ],
  };
}

/**
 * Generate a handle for a social login user
 */
export async function getHandleForUser(userInfo: SocialUserInfo): Promise<string> {
  const config = getPDSConfig();

  // Generate base handle from user info
  let baseHandle: string;

  if (userInfo.username) {
    // Use provider username (GitHub)
    baseHandle = sanitizeHandle(userInfo.username);
  } else if (userInfo.email) {
    // Use email prefix
    baseHandle = sanitizeHandle(userInfo.email.split('@')[0]);
  } else if (userInfo.displayName) {
    // Use display name
    baseHandle = sanitizeHandle(userInfo.displayName);
  } else {
    // Fallback to provider + id
    baseHandle = `${userInfo.provider}${userInfo.providerId.slice(-8)}`;
  }

  // Ensure handle is unique by checking database
  const { getDatabase } = await import('../../database/index.ts');
  const db = getDatabase();

  let handle = `${baseHandle}.${config.handleDomain}`;
  let counter = 0;

  // Check for existing handles and add suffix if needed
  while (true) {
    const existing = db
      .prepare('SELECT id FROM users WHERE handle = ?')
      .get(handle) as { id: number } | undefined;

    if (!existing) {
      break;
    }

    counter++;
    handle = `${baseHandle}${counter}.${config.handleDomain}`;
  }

  return handle;
}

/**
 * Sanitize a string to be a valid handle segment
 */
function sanitizeHandle(input: string): string {
  return (
    input
      .toLowerCase()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove invalid characters (only allow alphanumeric and hyphens)
      .replace(/[^a-z0-9-]/g, '')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Collapse multiple hyphens
      .replace(/-{2,}/g, '-')
      // Limit length
      .slice(0, 32) || 'user'
  );
}

/**
 * Resolve a handle to a DID
 */
export async function resolveHandle(handle: string): Promise<string | null> {
  const config = getPDSConfig();

  // Check if it's a local handle (on our domain)
  if (handle.endsWith(`.${config.handleDomain}`) || handle === config.handleDomain) {
    const { getDatabase } = await import('../../database/index.ts');
    const db = getDatabase();

    const user = db.prepare('SELECT did FROM users WHERE handle = ?').get(handle) as
      | { did: string }
      | undefined;

    return user?.did || null;
  }

  // For external handles, use DNS or HTTPS resolution
  return resolveExternalHandle(handle);
}

/**
 * Resolve an external handle via DNS TXT or HTTPS
 */
async function resolveExternalHandle(handle: string): Promise<string | null> {
  // Try HTTPS well-known first
  try {
    const response = await fetch(`https://${handle}/.well-known/atproto-did`, {
      headers: { Accept: 'text/plain' },
    });

    if (response.ok) {
      const did = (await response.text()).trim();
      if (did.startsWith('did:')) {
        return did;
      }
    }
  } catch {
    // HTTPS resolution failed, try DNS
  }

  // DNS TXT record resolution would require a DNS library
  // For now, return null and rely on HTTPS
  return null;
}

/**
 * Verify that a handle points to a DID (bidirectional verification)
 */
export async function verifyHandle(handle: string, did: string): Promise<boolean> {
  const resolvedDid = await resolveHandle(handle);
  return resolvedDid === did;
}

/**
 * Update a user's handle
 */
export async function updateHandle(did: string, newHandle: string): Promise<boolean> {
  const { getDatabase } = await import('../../database/index.ts');
  const db = getDatabase();

  // Check that the new handle isn't taken
  const existing = db.prepare('SELECT id FROM users WHERE handle = ? AND did != ?').get(newHandle, did);

  if (existing) {
    return false;
  }

  // Update handle
  const result = db.prepare('UPDATE users SET handle = ? WHERE did = ?').run(newHandle, did);

  // In production, we'd also need to update the PLC directory
  // with a new signed operation

  return result.changes > 0;
}
