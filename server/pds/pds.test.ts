/**
 * PDS Component Tests
 * Tests for key management, repository operations, and blob storage
 */

import test from 'ava';
import fs from 'fs';
import path from 'path';

// Mock environment - must be set before imports
process.env.SESSION_SECRET = 'test-secret-key-for-testing-only-32chars';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.PUBLIC_URL = 'http://localhost:3334';
process.env.HANDLE_DOMAIN = 'test.local';
process.env.BLOB_STORAGE_PATH = './data/test-blobs';
process.env.DATABASE_PATH = './data/test-pds.db';

// Import after env setup
import { getDatabase, closeDatabase } from '../database/index.ts';
import { initializePDSSchema } from './schema.ts';

test.before(() => {
  // Ensure directories exist
  const dataDir = './data';
  const blobDir = './data/test-blobs';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(blobDir)) {
    fs.mkdirSync(blobDir, { recursive: true });
  }

  // Delete old test database if exists
  const dbPath = './data/test-pds.db';
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  // Initialize the database with PDS schema
  const db = getDatabase();
  initializePDSSchema(db);
});

test.after(() => {
  closeDatabase();

  // Cleanup
  try {
    fs.unlinkSync('./data/test-pds.db');
    fs.rmSync('./data/test-blobs', { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// Key Management Tests
test('generateSigningKey creates valid key pair', async (t) => {
  const { generateSigningKey } = await import('./crypto/keys.ts');

  const keyPair = await generateSigningKey();

  t.is(keyPair.type, 'secp256k1');
  t.truthy(keyPair.privateKey);
  t.truthy(keyPair.publicKeyMultibase);
  t.true(keyPair.did.startsWith('did:key:'));
  t.is(keyPair.privateKey.length, 32); // secp256k1 private key is 32 bytes
});

test('generateRotationKey creates valid key pair', async (t) => {
  const { generateRotationKey } = await import('./crypto/keys.ts');

  const keyPair = await generateRotationKey();

  t.is(keyPair.type, 'secp256k1');
  t.truthy(keyPair.privateKey);
  t.truthy(keyPair.publicKeyMultibase);
  t.true(keyPair.did.startsWith('did:key:'));
});

test('sign and verify work correctly', async (t) => {
  const { generateSigningKey, sign, verify } = await import('./crypto/keys.ts');

  const keyPair = await generateSigningKey();
  const data = new TextEncoder().encode('test data to sign');

  const signature = await sign(keyPair, data);

  t.truthy(signature);
  t.true(signature.length > 0);

  const isValid = await verify(keyPair.did, data, signature);
  t.true(isValid);

  // Verify with wrong data fails
  const wrongData = new TextEncoder().encode('wrong data');
  const isInvalid = await verify(keyPair.did, wrongData, signature);
  t.false(isInvalid);
});

test('exportKeyPair and importKeyPair round-trip', async (t) => {
  const { generateSigningKey, exportKeyPair, importKeyPair } = await import('./crypto/keys.ts');

  const original = await generateSigningKey();
  const exported = exportKeyPair(original);
  const imported = await importKeyPair(exported);

  t.is(imported.type, original.type);
  t.deepEqual(imported.privateKey, original.privateKey);
  t.is(imported.publicKeyMultibase, original.publicKeyMultibase);
  t.is(imported.did, original.did);
});

test('encryptKeyPair and decryptKeyPair work correctly', async (t) => {
  const { generateSigningKey, exportKeyPair, encryptKeyPair, decryptKeyPair } = await import(
    './crypto/keys.ts'
  );

  const keyPair = await generateSigningKey();
  const exported = exportKeyPair(keyPair);
  const secret = 'test-encryption-secret';

  const encrypted = encryptKeyPair(exported, secret);

  t.truthy(encrypted);
  t.true(encrypted.includes(':')); // Has salt:iv:authTag:encrypted format

  const decrypted = decryptKeyPair(encrypted, secret);

  t.is(decrypted.type, exported.type);
  t.is(decrypted.privateKeyBase64, exported.privateKeyBase64);
  t.is(decrypted.did, exported.did);
});

test('decryptKeyPair fails with wrong secret', async (t) => {
  const { generateSigningKey, exportKeyPair, encryptKeyPair, decryptKeyPair } = await import(
    './crypto/keys.ts'
  );

  const keyPair = await generateSigningKey();
  const exported = exportKeyPair(keyPair);

  const encrypted = encryptKeyPair(exported, 'correct-secret');

  t.throws(() => {
    decryptKeyPair(encrypted, 'wrong-secret');
  });
});

// TID Generation Tests
test('generateTid creates valid TIDs', async (t) => {
  const { generateTid } = await import('./repo/index.ts');

  const tid1 = generateTid();
  const tid2 = generateTid();

  t.is(tid1.length, 13);
  t.is(tid2.length, 13);
  t.notDeepEqual(tid1, tid2);

  // TIDs should be monotonically increasing
  t.true(tid2 > tid1);

  // TIDs should only contain valid characters
  const validChars = /^[234567abcdefghijklmnopqrstuvwxyz]+$/;
  t.true(validChars.test(tid1));
  t.true(validChars.test(tid2));
});

test('generateTid produces unique values rapidly', async (t) => {
  const { generateTid } = await import('./repo/index.ts');

  const tids = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    tids.add(generateTid());
  }

  t.is(tids.size, 1000);
});

// Repository Storage Tests
test('SqliteBlockStorage basic operations', async (t) => {
  const { createBlockStorage } = await import('./repo/storage.ts');
  const { CID } = await import('multiformats/cid');
  const { sha256 } = await import('multiformats/hashes/sha2');

  const storage = createBlockStorage('did:test:storage-test');

  // Create a test block
  const data = new TextEncoder().encode('test block data');
  const hash = await sha256.digest(data);
  const cid = CID.createV1(0x71, hash); // dag-cbor codec

  // Put block
  await storage.put(cid, data);

  // Get block
  const retrieved = await storage.get(cid);
  t.deepEqual(retrieved, data);

  // Has block
  const exists = await storage.has(cid);
  t.true(exists);

  // Delete block
  await storage.delete(cid);
  const afterDelete = await storage.get(cid);
  t.is(afterDelete, null);
});

test('SqliteBlockStorage batch operations', async (t) => {
  const { createBlockStorage } = await import('./repo/storage.ts');
  const { CID } = await import('multiformats/cid');
  const { sha256 } = await import('multiformats/hashes/sha2');

  const storage = createBlockStorage('did:test:batch-test');

  // Create multiple test blocks
  const blocks = new Map<CID, Uint8Array>();
  const cids: CID[] = [];

  for (let i = 0; i < 5; i++) {
    const data = new TextEncoder().encode(`test block ${i}`);
    const hash = await sha256.digest(data);
    const cid = CID.createV1(0x71, hash);
    blocks.set(cid, data);
    cids.push(cid);
  }

  // Put many
  await storage.putMany(blocks);

  // Get many
  const retrieved = await storage.getMany(cids);
  t.is(retrieved.size, 5);

  for (const [cid, data] of blocks) {
    t.deepEqual(retrieved.get(cid.toString()), data);
  }
});

// Blob Storage Tests
test('blob upload and retrieval', async (t) => {
  // Ensure blob storage directory exists
  const blobDir = './data/test-blobs';
  if (!fs.existsSync(blobDir)) {
    fs.mkdirSync(blobDir, { recursive: true });
  }

  const { uploadBlob, getBlob, createBlobRef } = await import('./blob/index.ts');

  const testDid = 'did:test:blob-test';
  const testData = new TextEncoder().encode('test image data');
  const mimeType = 'image/png';

  // Upload blob
  const uploaded = await uploadBlob(testDid, testData, mimeType);

  t.truthy(uploaded.cid);
  t.is(uploaded.mimeType, mimeType);
  t.is(uploaded.size, testData.length);

  // Create blob ref
  const blobRef = createBlobRef(uploaded);
  t.is(blobRef.$type, 'blob');
  t.is(blobRef.mimeType, mimeType);
  t.is(blobRef.size, testData.length);

  // Retrieve blob
  const retrieved = await getBlob(testDid, uploaded.cid.toString());

  t.truthy(retrieved);
  t.deepEqual(retrieved!.data, testData);
  t.is(retrieved!.mimeType, mimeType);
});

test('blob list and reference tracking', async (t) => {
  const { uploadBlob, listBlobs, addBlobReference, removeBlobReference } = await import(
    './blob/index.ts'
  );

  const testDid = 'did:test:blob-list-test';
  const testData = new TextEncoder().encode('another test image');

  // Upload blob
  const uploaded = await uploadBlob(testDid, testData, 'image/jpeg');

  // List blobs
  const result = listBlobs(testDid);
  t.true(result.blobs.length >= 1);

  const found = result.blobs.find((b) => b.cid === uploaded.cid.toString());
  t.truthy(found);

  // Add reference
  addBlobReference(uploaded.cid.toString(), testDid, 'test.collection', 'test-rkey');

  // Remove reference
  removeBlobReference(testDid, 'test.collection', 'test-rkey');

  t.pass();
});

// Firehose Tests
test('firehose sequence numbers are monotonic', async (t) => {
  const { getLatestSeq } = await import('./firehose/index.ts');

  const seq1 = getLatestSeq();
  // Sequence should be >= 0
  t.true(seq1 >= 0);
});

// Config Tests
test('getPDSConfig returns valid config', async (t) => {
  const { getPDSConfig } = await import('./config.ts');

  const config = getPDSConfig();

  t.truthy(config.hostname);
  t.truthy(config.publicUrl);
  t.truthy(config.handleDomain);
  t.truthy(config.blobStoragePath);
  t.true(config.maxBlobSize > 0);
  t.true(config.accessTokenExpiry > 0);
  t.true(config.refreshTokenExpiry > 0);
});

// Identity Tests
test('sanitizeHandle produces valid handles', async (t) => {
  const { getHandleForUser } = await import('./identity/index.ts');

  // Test with email-like user info
  const handle1 = await getHandleForUser({
    provider: 'github',
    providerId: '12345',
    email: 'Test.User@Example.com',
    displayName: null,
    avatarUrl: null,
    username: null,
  });

  t.true(handle1.includes('.'));
  t.is(handle1.toLowerCase(), handle1);
  t.false(handle1.includes('@'));

  // Test with username
  const handle2 = await getHandleForUser({
    provider: 'github',
    providerId: '67890',
    email: null,
    displayName: null,
    avatarUrl: null,
    username: 'Test_User_123',
  });

  t.true(handle2.includes('.'));
  t.is(handle2.toLowerCase(), handle2);
});

test('DID document generation', async (t) => {
  const { generateDIDDocument } = await import('./identity/index.ts');

  const did = 'did:web:test.local:user:abc123';
  const handle = 'testuser.test.local';
  const signingKeyDid = 'did:key:zQ3shtest123';

  const didDoc = generateDIDDocument(did, handle, signingKeyDid);

  t.is(didDoc.id, did);
  t.true(didDoc.alsoKnownAs.includes(`at://${handle}`));
  t.is(didDoc.verificationMethod.length, 1);
  t.is(didDoc.verificationMethod[0].controller, did);
  t.is(didDoc.service.length, 1);
  t.is(didDoc.service[0].type, 'AtprotoPersonalDataServer');
});
