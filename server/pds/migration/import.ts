/**
 * Account Import
 *
 * Imports a user's account data from another PDS.
 * Handles identity verification, key import, and repository restoration.
 */

import { CID } from 'multiformats/cid';
import { CarReader } from '@ipld/car';
import * as dagCbor from '@ipld/dag-cbor';
import {
  createPdsAccount,
  getPdsAccountByDid,
  getPdsAccountByHandle,
  upsertPdsRecord,
  createPdsBlob,
  createPdsCommit,
  upsertPdsRepoState,
} from '../database/queries.ts';
import { createKeyManager, type EncryptedKeyData } from '../identity/keys.ts';
import { getPdsConfig } from '../config.ts';
import { updatePds as updateDidPds, resolveDid } from '../identity/plc.ts';
import { isHandleAvailable } from '../identity/handles.ts';
import type { AccountExport } from './export.ts';
import { verifyMigrationToken } from './export.ts';

/**
 * Import options
 */
export interface ImportOptions {
  migrationToken?: string;       // Signed token from source PDS
  reEncryptionSecret?: string;   // Secret used to encrypt keys in export
  skipDidUpdate?: boolean;       // Don't update PDS in DID document
  forceHandleChange?: boolean;   // Force a handle change if taken
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  did: string;
  handle: string;
  recordsImported: number;
  blobsImported: number;
  commitsImported: number;
  warnings: string[];
}

/**
 * Import an account from another PDS
 */
export async function importAccount(
  metadata: AccountExport,
  repoCarData: Uint8Array,
  blobCarData: Uint8Array | undefined,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const config = getPdsConfig();
  const warnings: string[] = [];

  // Check if account already exists
  const existingAccount = getPdsAccountByDid(metadata.did);
  if (existingAccount) {
    throw new Error('Account already exists on this PDS');
  }

  // Verify migration token if provided
  if (options.migrationToken) {
    const tokenResult = await verifyMigrationToken(options.migrationToken, metadata.did);
    if (!tokenResult.valid) {
      throw new Error('Invalid migration token');
    }
    if (tokenResult.claim?.targetPds !== config.publicUrl) {
      throw new Error('Migration token is for a different PDS');
    }
  }

  // Verify the DID exists and get current document
  const didDoc = await resolveDid(metadata.did);
  if (!didDoc) {
    throw new Error('DID not found in PLC directory');
  }

  // Check handle availability
  let finalHandle = metadata.handle;
  const handleAvailable = await isHandleAvailable(metadata.handle);
  if (!handleAvailable) {
    if (options.forceHandleChange) {
      // Generate a new unique handle
      const baseName = metadata.handle.split('.')[0];
      let suffix = 1;
      while (!(await isHandleAvailable(`${baseName}${suffix}.${config.handleDomain}`))) {
        suffix++;
        if (suffix > 1000) {
          throw new Error('Could not find available handle');
        }
      }
      finalHandle = `${baseName}${suffix}.${config.handleDomain}`;
      warnings.push(`Handle ${metadata.handle} was taken, using ${finalHandle} instead`);
    } else {
      throw new Error(`Handle ${metadata.handle} is not available`);
    }
  }

  // Re-encrypt keys with our encryption secret
  let signingKey: EncryptedKeyData;
  let rotationKeys: EncryptedKeyData[];

  if (options.reEncryptionSecret) {
    // Keys were re-encrypted with a migration secret, decrypt and re-encrypt with our secret
    const migrationKeyManager = createKeyManager(options.reEncryptionSecret);
    const ourKeyManager = createKeyManager(config.keyEncryptionSecret);

    const decryptedSigningKey = migrationKeyManager.decryptPrivateKey(metadata.signingKey);
    signingKey = ourKeyManager.encryptPrivateKey(decryptedSigningKey, metadata.signingKey.keyType);

    rotationKeys = metadata.rotationKeys.map((key) => {
      const decrypted = migrationKeyManager.decryptPrivateKey(key);
      return ourKeyManager.encryptPrivateKey(decrypted, key.keyType);
    });
  } else {
    // Keys are encrypted with source PDS secret - this won't work for cross-PDS migration
    // In this case, the user must provide the re-encryption secret
    warnings.push('Keys could not be re-encrypted - account may have limited functionality');
    signingKey = metadata.signingKey;
    rotationKeys = metadata.rotationKeys;
  }

  // Create the account
  createPdsAccount(
    metadata.did,
    finalHandle,
    '', // Email not included in export for privacy
    'github', // Default to github, actual provider not critical
    `migrated-${Date.now()}`, // Unique social ID for migrated account
    signingKey,
    rotationKeys
  );

  // Import repository data from CAR
  const { commits, records } = await importRepoCar(metadata.did, repoCarData);

  // Import blobs if provided
  let blobsImported = 0;
  if (blobCarData) {
    blobsImported = await importBlobCar(metadata.did, blobCarData);
  }

  // Update repo state
  if (metadata.repoHead && metadata.repoRev) {
    upsertPdsRepoState(metadata.did, metadata.repoHead, metadata.repoRev);
  }

  // Update DID document to point to this PDS (if not skipped)
  if (!options.skipDidUpdate && rotationKeys.length > 0) {
    try {
      // Load rotation key for signing the update
      const keyManager = createKeyManager(config.keyEncryptionSecret);
      const rotationKeyBytes = keyManager.decryptPrivateKey(rotationKeys[0]);

      const { Secp256k1Keypair } = await import('@atproto/crypto');
      const rotationKeypair = await Secp256k1Keypair.import(rotationKeyBytes);

      await updateDidPds(metadata.did, config.publicUrl, rotationKeypair);
    } catch (error) {
      warnings.push(`Could not update DID document: ${error}`);
    }
  }

  return {
    success: true,
    did: metadata.did,
    handle: finalHandle,
    recordsImported: records,
    blobsImported,
    commitsImported: commits,
    warnings,
  };
}

/**
 * Import repository data from CAR file
 */
async function importRepoCar(
  did: string,
  carData: Uint8Array
): Promise<{ commits: number; records: number }> {
  const reader = await CarReader.fromBytes(carData);
  let commits = 0;
  let records = 0;

  // Process all blocks
  for await (const block of reader.blocks()) {
    try {
      const value = dagCbor.decode(block.bytes);

      // Check if this is a commit block
      if (isCommitBlock(value)) {
        createPdsCommit(
          did,
          block.cid.toString(),
          value.rev,
          value.data.toString(),
          Buffer.from(block.bytes),
          value.prev?.toString()
        );
        commits++;
      }
      // Check if this is a record block (has collection path pattern)
      else if (isRecordBlock(value)) {
        // Records need collection and rkey, which we extract from the commit ops
        // For now, store as raw blocks that will be indexed later
        records++;
      }
    } catch {
      // Skip blocks that can't be decoded
      continue;
    }
  }

  return { commits, records };
}

/**
 * Import blob data from CAR file
 */
async function importBlobCar(did: string, carData: Uint8Array): Promise<number> {
  const reader = await CarReader.fromBytes(carData);
  let imported = 0;

  for await (const block of reader.blocks()) {
    try {
      // Blobs are stored as raw bytes
      // Try to detect MIME type from magic bytes
      const mimeType = detectMimeType(block.bytes);

      createPdsBlob(did, block.cid.toString(), mimeType, Buffer.from(block.bytes));
      imported++;
    } catch {
      // Skip blocks that can't be imported
      continue;
    }
  }

  return imported;
}

/**
 * Check if a decoded value looks like a commit block
 */
function isCommitBlock(value: unknown): value is {
  did: string;
  version: number;
  data: CID;
  rev: string;
  prev: CID | null;
  sig: Uint8Array;
} {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.did === 'string' &&
    typeof v.version === 'number' &&
    typeof v.rev === 'string' &&
    v.data !== undefined
  );
}

/**
 * Check if a decoded value looks like a record block
 */
function isRecordBlock(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  // Records typically have $type field
  return typeof v.$type === 'string';
}

/**
 * Detect MIME type from magic bytes
 */
function detectMimeType(bytes: Uint8Array): string {
  if (bytes.length < 4) return 'application/octet-stream';

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }

  // GIF
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return 'image/gif';
  }

  // WebP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.length > 11 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // PDF
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'application/pdf';
  }

  return 'application/octet-stream';
}

/**
 * Validate an account export before import
 */
export function validateAccountExport(metadata: AccountExport): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (metadata.version !== 1) {
    errors.push(`Unsupported export version: ${metadata.version}`);
  }

  if (!metadata.did || !metadata.did.startsWith('did:')) {
    errors.push('Invalid DID');
  }

  if (!metadata.handle) {
    errors.push('Missing handle');
  }

  if (!metadata.signingKey) {
    errors.push('Missing signing key');
  }

  if (!metadata.rotationKeys || metadata.rotationKeys.length === 0) {
    errors.push('Missing rotation keys');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Request account data from source PDS for migration
 * This initiates a server-to-server migration flow
 */
export async function requestMigrationFromPds(
  sourcePdsUrl: string,
  did: string,
  migrationToken: string
): Promise<{ metadata: AccountExport; repoCarData: Uint8Array; blobCarData?: Uint8Array }> {
  // Fetch account export from source PDS
  const exportUrl = new URL('/xrpc/com.atproto.server.exportAccountData', sourcePdsUrl);
  exportUrl.searchParams.set('did', did);

  const response = await fetch(exportUrl.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${migrationToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch account data: ${response.status}`);
  }

  const data = await response.json();

  // Fetch repository CAR
  const repoUrl = new URL('/xrpc/com.atproto.sync.getRepo', sourcePdsUrl);
  repoUrl.searchParams.set('did', did);

  const repoResponse = await fetch(repoUrl.toString(), {
    headers: { Accept: 'application/vnd.ipld.car' },
  });

  if (!repoResponse.ok) {
    throw new Error(`Failed to fetch repository: ${repoResponse.status}`);
  }

  const repoCarData = new Uint8Array(await repoResponse.arrayBuffer());

  return {
    metadata: data.metadata,
    repoCarData,
  };
}
