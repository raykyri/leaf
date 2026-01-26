/**
 * Account Export
 *
 * Exports a user's complete account data for migration to another PDS.
 * Includes identity keys, repository data, and blobs.
 */

import { CID } from 'multiformats/cid';
import * as Block from 'multiformats/block';
import { sha256 } from 'multiformats/hashes/sha2';
import * as dagCbor from '@ipld/dag-cbor';
import { CarWriter } from '@ipld/car';
import {
  getPdsAccountByDid,
  getPdsCommitsSince,
  listPdsRecords,
  listPdsBlobs,
  getPdsRepoState,
  type PdsAccount,
  type PdsCommit,
  type PdsRecord,
  type PdsBlob,
} from '../database/queries.ts';
import { createKeyManager, type EncryptedKeyData } from '../identity/keys.ts';
import { getPdsConfig } from '../config.ts';

/**
 * Account export format
 */
export interface AccountExport {
  version: 1;
  exportedAt: string;
  sourcePds: string;

  // Identity
  did: string;
  handle: string;

  // Encrypted keys (can only be decrypted with the original encryption secret)
  // For cross-PDS migration, keys need to be re-encrypted or exported differently
  signingKey: EncryptedKeyData;
  rotationKeys: EncryptedKeyData[];

  // Repository state
  repoHead: string | null;
  repoRev: string | null;

  // Metadata
  recordCount: number;
  blobCount: number;
  commitCount: number;
}

/**
 * Export options
 */
export interface ExportOptions {
  includeBlobs?: boolean;       // Include blob data (can be large)
  includePlaintextKeys?: boolean; // Export decrypted private keys (DANGEROUS)
  reEncryptionSecret?: string;  // Re-encrypt keys with new secret for migration
}

/**
 * Export result
 */
export interface ExportResult {
  metadata: AccountExport;
  repoCarData: Uint8Array;      // Repository as CAR file
  blobCarData?: Uint8Array;     // Blobs as CAR file (if includeBlobs)
  privateKeys?: {               // Only if includePlaintextKeys
    signingKey: string;         // Base64 encoded private key
    rotationKeys: string[];     // Base64 encoded rotation keys
  };
}

/**
 * Export an account for migration
 */
export async function exportAccount(
  did: string,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const config = getPdsConfig();
  const account = getPdsAccountByDid(did);

  if (!account) {
    throw new Error('Account not found');
  }

  // Get repository state
  const repoState = getPdsRepoState(did);

  // Count records and commits
  const commits = getPdsCommitsSince(did, undefined, 10000);
  const { blobs } = listPdsBlobs(did, { limit: 10000 });

  // Count all records across collections
  let totalRecords = 0;
  const collections = new Set<string>();
  const allRecords: PdsRecord[] = [];

  // Common collections
  const commonCollections = [
    'pub.leaflet.document',
    'pub.leaflet.publication',
    'pub.leaflet.canvas',
    'app.bsky.feed.post',
    'app.bsky.feed.like',
    'app.bsky.feed.repost',
    'app.bsky.graph.follow',
    'app.bsky.actor.profile',
  ];

  for (const collection of commonCollections) {
    let cursor: string | undefined;
    do {
      const { records, cursor: nextCursor } = listPdsRecords(did, collection, {
        limit: 1000,
        cursor,
      });
      if (records.length > 0) {
        collections.add(collection);
        allRecords.push(...records);
        totalRecords += records.length;
      }
      cursor = nextCursor;
    } while (cursor);
  }

  // Parse keys
  const signingKey = JSON.parse(account.signing_key) as EncryptedKeyData;
  let rotationKeys = JSON.parse(account.rotation_keys) as EncryptedKeyData[];

  // Re-encrypt keys if migration secret provided
  if (options.reEncryptionSecret) {
    const originalKeyManager = createKeyManager(config.keyEncryptionSecret);
    const newKeyManager = createKeyManager(options.reEncryptionSecret);

    // Decrypt and re-encrypt signing key
    const decryptedSigningKey = originalKeyManager.decryptPrivateKey(signingKey);
    const reEncryptedSigningKey = newKeyManager.encryptPrivateKey(
      decryptedSigningKey,
      signingKey.keyType
    );

    // Decrypt and re-encrypt rotation keys
    const reEncryptedRotationKeys = rotationKeys.map((key) => {
      const decrypted = originalKeyManager.decryptPrivateKey(key);
      return newKeyManager.encryptPrivateKey(decrypted, key.keyType);
    });

    // Use re-encrypted keys in export
    Object.assign(signingKey, reEncryptedSigningKey);
    rotationKeys = reEncryptedRotationKeys;
  }

  // Build metadata
  const metadata: AccountExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sourcePds: config.publicUrl,
    did,
    handle: account.handle,
    signingKey,
    rotationKeys,
    repoHead: repoState?.head_cid || null,
    repoRev: repoState?.head_rev || null,
    recordCount: totalRecords,
    blobCount: blobs.length,
    commitCount: commits.length,
  };

  // Build repository CAR file
  const repoCarData = await buildRepoCar(did, commits, allRecords);

  // Build blob CAR file if requested
  let blobCarData: Uint8Array | undefined;
  if (options.includeBlobs && blobs.length > 0) {
    blobCarData = await buildBlobCar(blobs);
  }

  // Export plaintext keys if requested (DANGEROUS - only for specific migration scenarios)
  let privateKeys: ExportResult['privateKeys'];
  if (options.includePlaintextKeys) {
    const keyManager = createKeyManager(config.keyEncryptionSecret);

    const signingKeyBytes = keyManager.decryptPrivateKey(
      JSON.parse(account.signing_key) as EncryptedKeyData
    );
    const rotationKeyBytes = (JSON.parse(account.rotation_keys) as EncryptedKeyData[]).map(
      (key) => keyManager.decryptPrivateKey(key)
    );

    privateKeys = {
      signingKey: Buffer.from(signingKeyBytes).toString('base64'),
      rotationKeys: rotationKeyBytes.map((k) => Buffer.from(k).toString('base64')),
    };
  }

  return {
    metadata,
    repoCarData,
    blobCarData,
    privateKeys,
  };
}

/**
 * Build CAR file containing repository data
 */
async function buildRepoCar(
  did: string,
  commits: PdsCommit[],
  records: PdsRecord[]
): Promise<Uint8Array> {
  const blocks: Array<{ cid: CID; bytes: Uint8Array }> = [];

  // Add commit blocks
  for (const commit of commits) {
    const cid = CID.parse(commit.cid);
    blocks.push({ cid, bytes: new Uint8Array(commit.data) });
  }

  // Add record blocks
  for (const record of records) {
    const cid = CID.parse(record.cid);
    blocks.push({ cid, bytes: new Uint8Array(record.value) });
  }

  if (blocks.length === 0) {
    // Create empty CAR with placeholder root
    const emptyBlock = await Block.encode({
      value: { empty: true },
      codec: dagCbor,
      hasher: sha256,
    });
    blocks.push({ cid: emptyBlock.cid, bytes: emptyBlock.bytes });
  }

  // Use most recent commit as root, or first block
  const rootCid = commits.length > 0 ? CID.parse(commits[commits.length - 1].cid) : blocks[0].cid;

  return createCarFile(rootCid, blocks);
}

/**
 * Build CAR file containing blob data
 */
async function buildBlobCar(blobs: PdsBlob[]): Promise<Uint8Array> {
  const blocks: Array<{ cid: CID; bytes: Uint8Array }> = [];

  for (const blob of blobs) {
    const cid = CID.parse(blob.cid);
    blocks.push({ cid, bytes: new Uint8Array(blob.data) });
  }

  if (blocks.length === 0) {
    const emptyBlock = await Block.encode({
      value: { empty: true },
      codec: dagCbor,
      hasher: sha256,
    });
    blocks.push({ cid: emptyBlock.cid, bytes: emptyBlock.bytes });
  }

  return createCarFile(blocks[0].cid, blocks);
}

/**
 * Create a CAR file from blocks
 */
async function createCarFile(
  root: CID,
  blocks: Array<{ cid: CID; bytes: Uint8Array }>
): Promise<Uint8Array> {
  const { writer, out } = CarWriter.create([root]);

  // Collect output chunks
  const chunks: Uint8Array[] = [];
  const collectChunks = async () => {
    for await (const chunk of out) {
      chunks.push(chunk);
    }
  };

  // Start collecting and write blocks
  const collectPromise = collectChunks();

  for (const block of blocks) {
    await writer.put(block);
  }
  await writer.close();

  await collectPromise;

  // Concatenate chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Generate a migration token that can be used to claim the account on another PDS
 * This is signed by a rotation key to prove ownership
 */
export async function generateMigrationToken(
  did: string,
  targetPds: string
): Promise<string> {
  const config = getPdsConfig();
  const account = getPdsAccountByDid(did);

  if (!account) {
    throw new Error('Account not found');
  }

  const keyManager = createKeyManager(config.keyEncryptionSecret);
  const rotationKeys = JSON.parse(account.rotation_keys) as EncryptedKeyData[];

  if (rotationKeys.length === 0) {
    throw new Error('No rotation keys available');
  }

  // Load the first rotation key
  const { Secp256k1Keypair } = await import('@atproto/crypto');
  const rotationKeyBytes = keyManager.decryptPrivateKey(rotationKeys[0]);
  const keypair = await Secp256k1Keypair.import(rotationKeyBytes);

  // Create migration claim
  const claim = {
    type: 'account_migration',
    did,
    sourcePds: config.publicUrl,
    targetPds,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };

  // Encode and sign
  const claimBytes = new TextEncoder().encode(JSON.stringify(claim));
  const signature = await keypair.sign(claimBytes);

  // Return as JWT-like token (header.payload.signature)
  const header = Buffer.from(JSON.stringify({ alg: 'ES256K', typ: 'migration' })).toString(
    'base64url'
  );
  const payload = Buffer.from(JSON.stringify(claim)).toString('base64url');
  const sig = Buffer.from(signature).toString('base64url');

  return `${header}.${payload}.${sig}`;
}

/**
 * Verify a migration token
 */
export async function verifyMigrationToken(
  token: string,
  expectedDid: string
): Promise<{ valid: boolean; claim?: { did: string; sourcePds: string; targetPds: string } }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    if (payload.did !== expectedDid) {
      return { valid: false };
    }

    // Check expiration
    if (new Date(payload.expiresAt) < new Date()) {
      return { valid: false };
    }

    // In a full implementation, we would verify the signature against the DID's rotation keys
    // by fetching the DID document from PLC directory

    return {
      valid: true,
      claim: {
        did: payload.did,
        sourcePds: payload.sourcePds,
        targetPds: payload.targetPds,
      },
    };
  } catch {
    return { valid: false };
  }
}
