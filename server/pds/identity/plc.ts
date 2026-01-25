/**
 * did:plc Identity Management
 *
 * Creates and manages did:plc identities for social login users.
 * Uses the @did-plc/lib package and plc.directory service.
 */

import * as plc from '@did-plc/lib';
import { Secp256k1Keypair } from '@atproto/crypto';
import { getPdsConfig } from '../config.ts';
import { createKeyManager, type EncryptedKeyData } from './keys.ts';

export interface CreateIdentityOptions {
  handle: string;
  signingKey: Secp256k1Keypair;
  rotationKeys: Secp256k1Keypair[];
}

export interface IdentityData {
  did: string;
  handle: string;
  signingKey: EncryptedKeyData;
  rotationKeys: EncryptedKeyData[];
}

/**
 * Create a new did:plc identity
 */
export async function createIdentity(options: CreateIdentityOptions): Promise<IdentityData> {
  const config = getPdsConfig();
  const keyManager = createKeyManager(config.keyEncryptionSecret);

  // Create PLC client
  const client = new plc.Client(config.plcDirectoryUrl);

  // Create the DID
  const did = await client.createDid({
    signingKey: options.signingKey.did(),
    handle: options.handle,
    pds: config.publicUrl,
    rotationKeys: options.rotationKeys.map(k => k.did()),
    signer: options.rotationKeys[0], // Use first rotation key to sign genesis operation
  });

  // Encrypt keys for storage
  const signingKeyData = keyManager.exportKeypair(options.signingKey, 'secp256k1');
  const rotationKeysData = options.rotationKeys.map(k =>
    keyManager.exportKeypair(k, 'secp256k1')
  );

  return {
    did,
    handle: options.handle,
    signingKey: signingKeyData,
    rotationKeys: rotationKeysData,
  };
}

/**
 * Resolve a DID to get its document
 */
export async function resolveDid(did: string): Promise<plc.DidDocument | null> {
  const config = getPdsConfig();
  const client = new plc.Client(config.plcDirectoryUrl);

  try {
    return await client.getDocument(did);
  } catch (error) {
    // DID not found or error
    return null;
  }
}

/**
 * Get the current data for a DID (internal format)
 */
export async function getDidData(did: string): Promise<plc.DocumentData | null> {
  const config = getPdsConfig();
  const client = new plc.Client(config.plcDirectoryUrl);

  try {
    return await client.getDocumentData(did);
  } catch (error) {
    return null;
  }
}

/**
 * Update the handle for a DID
 */
export async function updateHandle(
  did: string,
  newHandle: string,
  rotationKey: Secp256k1Keypair
): Promise<void> {
  const config = getPdsConfig();
  const client = new plc.Client(config.plcDirectoryUrl);

  // Get current data
  const currentData = await client.getDocumentData(did);
  if (!currentData) {
    throw new Error('DID not found');
  }

  // Create update operation
  await client.updateHandle(did, rotationKey, newHandle);
}

/**
 * Update the PDS endpoint for a DID
 */
export async function updatePds(
  did: string,
  newPdsUrl: string,
  rotationKey: Secp256k1Keypair
): Promise<void> {
  const config = getPdsConfig();
  const client = new plc.Client(config.plcDirectoryUrl);

  // Get current data
  const currentData = await client.getDocumentData(did);
  if (!currentData) {
    throw new Error('DID not found');
  }

  // Create update operation
  await client.updatePds(did, rotationKey, newPdsUrl);
}

/**
 * Rotate signing key
 */
export async function rotateSigningKey(
  did: string,
  newSigningKey: Secp256k1Keypair,
  rotationKey: Secp256k1Keypair
): Promise<void> {
  const config = getPdsConfig();
  const client = new plc.Client(config.plcDirectoryUrl);

  // Get current data
  const currentData = await client.getDocumentData(did);
  if (!currentData) {
    throw new Error('DID not found');
  }

  // Update signing key
  await client.updateAtprotoKey(did, rotationKey, newSigningKey.did());
}

/**
 * Deactivate a DID (tombstone)
 */
export async function deactivateDid(
  did: string,
  rotationKey: Secp256k1Keypair
): Promise<void> {
  const config = getPdsConfig();
  const client = new plc.Client(config.plcDirectoryUrl);

  // Create tombstone operation
  await client.tombstone(did, rotationKey);
}

/**
 * Load a signing keypair from encrypted storage
 */
export async function loadSigningKey(encrypted: EncryptedKeyData): Promise<Secp256k1Keypair> {
  const config = getPdsConfig();
  const keyManager = createKeyManager(config.keyEncryptionSecret);

  const keypair = await keyManager.loadKeypair(encrypted);
  return keypair as Secp256k1Keypair;
}

/**
 * Load rotation keypairs from encrypted storage
 */
export async function loadRotationKeys(encryptedKeys: EncryptedKeyData[]): Promise<Secp256k1Keypair[]> {
  const config = getPdsConfig();
  const keyManager = createKeyManager(config.keyEncryptionSecret);

  const keys: Secp256k1Keypair[] = [];
  for (const encrypted of encryptedKeys) {
    const keypair = await keyManager.loadKeypair(encrypted);
    keys.push(keypair as Secp256k1Keypair);
  }
  return keys;
}

/**
 * Check if a handle is available (not already registered)
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const config = getPdsConfig();
  const client = new plc.Client(config.plcDirectoryUrl);

  try {
    // Try to resolve the handle via well-known
    const response = await fetch(`https://${handle}/.well-known/atproto-did`, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' },
    });

    // If we get a DID back, the handle is taken
    if (response.ok) {
      return false;
    }

    // Handle not found, likely available
    return true;
  } catch {
    // Error checking, assume available but log warning
    console.warn(`Could not verify handle availability for ${handle}`);
    return true;
  }
}

/**
 * Generate a unique handle, adding a suffix if needed
 */
export async function generateUniqueHandle(baseHandle: string): Promise<string> {
  let handle = baseHandle;
  let suffix = 0;

  while (!(await isHandleAvailable(handle))) {
    suffix++;
    // Extract the username part and domain
    const parts = baseHandle.split('.');
    const username = parts[0];
    const domain = parts.slice(1).join('.');
    handle = `${username}${suffix}.${domain}`;

    // Safety limit
    if (suffix > 100) {
      throw new Error('Could not generate unique handle');
    }
  }

  return handle;
}
