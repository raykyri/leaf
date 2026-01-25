/**
 * Cryptographic Key Management
 *
 * Handles generation, encryption, and storage of signing keys for PDS accounts.
 * Keys are encrypted at rest using AES-256-GCM.
 */

import crypto from 'crypto';
import { Secp256k1Keypair, P256Keypair } from '@atproto/crypto';

// Key types supported by ATProto
export type KeypairType = 'secp256k1' | 'p256';

export interface EncryptedKeyData {
  // The encrypted private key (base64)
  ciphertext: string;
  // The IV used for encryption (base64)
  iv: string;
  // The auth tag from AES-GCM (base64)
  tag: string;
  // Key type indicator
  keyType: KeypairType;
}

export interface KeyManager {
  /**
   * Generate a new signing keypair
   */
  generateSigningKey(type?: KeypairType): Promise<Secp256k1Keypair | P256Keypair>;

  /**
   * Generate rotation keypairs (typically 2-3 for recovery)
   */
  generateRotationKeys(count?: number): Promise<Secp256k1Keypair[]>;

  /**
   * Encrypt a private key for storage
   */
  encryptPrivateKey(privateKey: Uint8Array, keyType: KeypairType): EncryptedKeyData;

  /**
   * Decrypt a private key from storage
   */
  decryptPrivateKey(encrypted: EncryptedKeyData): Uint8Array;

  /**
   * Load a keypair from encrypted storage data
   */
  loadKeypair(encrypted: EncryptedKeyData): Promise<Secp256k1Keypair | P256Keypair>;

  /**
   * Export keypair to encrypted storage format
   */
  exportKeypair(keypair: Secp256k1Keypair | P256Keypair, keyType: KeypairType): EncryptedKeyData;
}

/**
 * Create a key manager with the given encryption secret
 */
export function createKeyManager(encryptionSecret: string): KeyManager {
  // Derive a 256-bit encryption key from the secret using HKDF
  const encryptionKey = crypto.hkdfSync(
    'sha256',
    encryptionSecret,
    'leaf-pds-key-encryption',
    'aes-256-gcm-key',
    32
  );

  return {
    async generateSigningKey(type: KeypairType = 'secp256k1'): Promise<Secp256k1Keypair | P256Keypair> {
      if (type === 'p256') {
        return P256Keypair.create();
      }
      return Secp256k1Keypair.create();
    },

    async generateRotationKeys(count = 2): Promise<Secp256k1Keypair[]> {
      const keys: Secp256k1Keypair[] = [];
      for (let i = 0; i < count; i++) {
        keys.push(await Secp256k1Keypair.create());
      }
      return keys;
    },

    encryptPrivateKey(privateKey: Uint8Array, keyType: KeypairType): EncryptedKeyData {
      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(12);

      // Create AES-256-GCM cipher
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

      // Encrypt the private key
      const encrypted = Buffer.concat([
        cipher.update(privateKey),
        cipher.final()
      ]);

      // Get the auth tag
      const tag = cipher.getAuthTag();

      return {
        ciphertext: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        keyType,
      };
    },

    decryptPrivateKey(encrypted: EncryptedKeyData): Uint8Array {
      const iv = Buffer.from(encrypted.iv, 'base64');
      const tag = Buffer.from(encrypted.tag, 'base64');
      const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

      // Create AES-256-GCM decipher
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
      decipher.setAuthTag(tag);

      // Decrypt the private key
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);

      return new Uint8Array(decrypted);
    },

    async loadKeypair(encrypted: EncryptedKeyData): Promise<Secp256k1Keypair | P256Keypair> {
      const privateKey = this.decryptPrivateKey(encrypted);

      if (encrypted.keyType === 'p256') {
        return P256Keypair.import(privateKey);
      }
      return Secp256k1Keypair.import(privateKey);
    },

    exportKeypair(keypair: Secp256k1Keypair | P256Keypair, keyType: KeypairType): EncryptedKeyData {
      // Export the private key bytes
      const privateKeyBytes = keypair.export();
      return this.encryptPrivateKey(privateKeyBytes, keyType);
    },
  };
}

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for secure storage comparison
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a TID (timestamp-based ID) for record keys
 * TIDs are sortable, unique identifiers used in ATProto
 */
export function generateTid(): string {
  // TID format: base32-sortable encoding of timestamp + random
  const now = BigInt(Date.now()) * 1000n; // microseconds
  const clockId = BigInt(crypto.randomBytes(2).readUInt16BE(0));

  // Combine into 64-bit value
  const tid = (now << 10n) | clockId;

  // Convert to base32-sortable (using the ATProto alphabet)
  return encodeBase32Sort(tid);
}

const BASE32_SORT_ALPHABET = '234567abcdefghijklmnopqrstuvwxyz';

function encodeBase32Sort(value: bigint): string {
  const chars: string[] = [];
  let remaining = value;

  // Encode 13 characters (65 bits, but we only use 64)
  for (let i = 0; i < 13; i++) {
    const idx = Number(remaining & 31n);
    chars.unshift(BASE32_SORT_ALPHABET[idx]);
    remaining >>= 5n;
  }

  return chars.join('');
}

/**
 * Validate a TID format
 */
export function isValidTid(tid: string): boolean {
  if (tid.length !== 13) return false;
  for (const char of tid) {
    if (!BASE32_SORT_ALPHABET.includes(char)) return false;
  }
  return true;
}
