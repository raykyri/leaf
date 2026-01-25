/**
 * Key Management Module
 * Handles cryptographic key generation, storage, and signing operations
 * Uses @atproto/crypto for compatibility with ATProto
 */

import * as crypto from '@atproto/crypto';
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

// Key types supported by ATProto
export type KeyType = 'secp256k1' | 'p256';

export interface KeyPair {
  /** Key type (algorithm) */
  type: KeyType;
  /** Private key bytes */
  privateKey: Uint8Array;
  /** Public key in multikey format (did:key compatible) */
  publicKeyMultibase: string;
  /** DID key representation */
  did: string;
}

export interface ExportedKeyPair {
  type: KeyType;
  privateKeyBase64: string;
  publicKeyMultibase: string;
  did: string;
}

// Encryption parameters for key storage
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Generate a new secp256k1 key pair (default for ATProto signing keys)
 * Creates keys with exportable: true for storage
 */
export async function generateSigningKey(): Promise<KeyPair> {
  // Generate raw private key bytes
  const privateKeyBytes = randomBytes(32);

  // Create keypair with exportable flag
  const keypair = await crypto.Secp256k1Keypair.import(privateKeyBytes, { exportable: true });

  return {
    type: 'secp256k1',
    privateKey: new Uint8Array(privateKeyBytes),
    publicKeyMultibase: keypair.did().replace('did:key:', ''),
    did: keypair.did(),
  };
}

/**
 * Generate a new P-256 key pair (alternative, more widely supported)
 */
export async function generateP256Key(): Promise<KeyPair> {
  // Generate raw private key bytes
  const privateKeyBytes = randomBytes(32);

  // Create keypair with exportable flag
  const keypair = await crypto.P256Keypair.import(privateKeyBytes, { exportable: true });

  return {
    type: 'p256',
    privateKey: new Uint8Array(privateKeyBytes),
    publicKeyMultibase: keypair.did().replace('did:key:', ''),
    did: keypair.did(),
  };
}

/**
 * Generate a rotation key (used for PLC operations)
 * Uses secp256k1 by default
 */
export async function generateRotationKey(): Promise<KeyPair> {
  return generateSigningKey();
}

/**
 * Import a key pair from exported format
 */
export async function importKeyPair(exported: ExportedKeyPair): Promise<KeyPair> {
  const privateKeyBytes = Buffer.from(exported.privateKeyBase64, 'base64');

  return {
    type: exported.type,
    privateKey: new Uint8Array(privateKeyBytes),
    publicKeyMultibase: exported.publicKeyMultibase,
    did: exported.did,
  };
}

/**
 * Export a key pair to storable format
 */
export function exportKeyPair(keyPair: KeyPair): ExportedKeyPair {
  return {
    type: keyPair.type,
    privateKeyBase64: Buffer.from(keyPair.privateKey).toString('base64'),
    publicKeyMultibase: keyPair.publicKeyMultibase,
    did: keyPair.did,
  };
}

/**
 * Get a Keypair instance from our KeyPair format (for signing)
 */
export async function getKeypairInstance(
  keyPair: KeyPair
): Promise<crypto.Secp256k1Keypair | crypto.P256Keypair> {
  if (keyPair.type === 'secp256k1') {
    return crypto.Secp256k1Keypair.import(keyPair.privateKey, { exportable: true });
  } else {
    return crypto.P256Keypair.import(keyPair.privateKey, { exportable: true });
  }
}

/**
 * Sign data using a key pair
 */
export async function sign(keyPair: KeyPair, data: Uint8Array): Promise<Uint8Array> {
  const keypairInstance = await getKeypairInstance(keyPair);
  return keypairInstance.sign(data);
}

/**
 * Verify a signature
 */
export async function verify(
  publicKeyDid: string,
  data: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  try {
    return await crypto.verifySignature(publicKeyDid, data, signature);
  } catch {
    return false;
  }
}

/**
 * Encrypt a key pair for secure storage
 */
export function encryptKeyPair(keyPair: ExportedKeyPair, secret: string): string {
  const data = JSON.stringify(keyPair);
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(secret, salt, KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: salt:iv:authTag:encrypted (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a key pair from storage
 */
export function decryptKeyPair(encryptedData: string, secret: string): ExportedKeyPair {
  const [saltB64, ivB64, authTagB64, encryptedB64] = encryptedData.split(':');

  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const key = scryptSync(secret, salt, KEY_LENGTH);

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Generate a random DID-compatible identifier suffix
 */
export function generateDidSuffix(): string {
  // Generate 16 random bytes and encode as base32
  const bytes = randomBytes(16);
  return base32Encode(bytes);
}

/**
 * Base32 encoding (RFC 4648, lowercase, no padding)
 */
function base32Encode(data: Buffer): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }

  return result;
}
