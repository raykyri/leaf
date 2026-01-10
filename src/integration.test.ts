/**
 * Integration tests for the Leaflet ATProto blogging platform.
 *
 * These tests use real ATProto credentials to test the full lifecycle:
 * - Authentication with real PDS
 * - Creating posts that write to the user's PDS
 * - Resyncing (clearing local DB and re-indexing from PDS)
 * - Verifying posts persist across resyncs
 *
 * Required environment variables:
 * - TEST_HANDLE: ATProto handle (e.g., "raymond.bsky.social")
 * - TEST_APP_PASSWORD: App password for the test account
 */

import test from 'ava';
import { AtpAgent } from '@atproto/api';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { initializeDatabase } from './database/schema.js';

// Test configuration
const TEST_HANDLE = process.env.TEST_HANDLE;
const TEST_APP_PASSWORD = process.env.TEST_APP_PASSWORD;
const TEST_DB_PATH = './data/test-integration.db';
const LEAFLET_DOCUMENT_COLLECTION = 'pub.leaflet.document';

// Skip tests if credentials not provided
const hasCredentials = TEST_HANDLE && TEST_APP_PASSWORD;

// Log skip reason if credentials not provided
if (!hasCredentials) {
  console.log('Skipping ATProto integration tests: TEST_HANDLE and TEST_APP_PASSWORD not set in environment');
}

// Test utilities
function createTestDb(): Database.Database {
  // Ensure data directory exists
  const dir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const db = new Database(TEST_DB_PATH);
  initializeDatabase(db);
  return db;
}

function generateTestTid(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `test${timestamp.toString(36)}${random}`;
}

// Helper to clean up test documents from PDS
async function deleteTestDocuments(agent: AtpAgent, did: string): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;

  do {
    try {
      const response = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        limit: 100,
        cursor
      });

      for (const record of response.data.records) {
        // Only delete test documents (those with title starting with "[TEST]")
        const doc = record.value as { title?: string };
        if (doc.title?.startsWith('[TEST]')) {
          const rkey = record.uri.split('/').pop()!;
          await agent.com.atproto.repo.deleteRecord({
            repo: did,
            collection: LEAFLET_DOCUMENT_COLLECTION,
            rkey
          });
          deleted++;
        }
      }

      cursor = response.data.cursor;
    } catch {
      break;
    }
  } while (cursor);

  return deleted;
}

// Skip flag for conditional tests
const skipIfNoCredentials = !hasCredentials;

test('Authentication › should authenticate with real ATProto credentials', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  t.truthy(agent.session);
  t.regex(agent.session!.did, /^did:(plc|web):/);
  t.is(agent.session!.handle, TEST_HANDLE);
});

test('Authentication › should get user profile', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  const profile = await agent.getProfile({ actor: userDid });
  t.is(profile.data.did, userDid);
  t.is(profile.data.handle, TEST_HANDLE);
});

test('Authentication › should resolve PDS URL', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  t.truthy(agent.pdsUrl);
});

// Creating Posts tests
test('Creating Posts › should create a Leaflet document on the PDS', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  const rkey = generateTestTid();

  try {
    const document = {
      $type: 'pub.leaflet.document',
      title: '[TEST] Integration Test Post',
      description: 'Created by integration test',
      author: userDid,
      pages: [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: {
            $type: 'pub.leaflet.blocks.text',
            plaintext: 'This is a test post created by the integration test suite.',
            facets: []
          }
        }]
      }],
      publishedAt: new Date().toISOString()
    };

    const response = await agent.com.atproto.repo.createRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey,
      record: document
    });

    t.true(response.data.uri.includes(userDid));
    t.true(response.data.uri.includes(LEAFLET_DOCUMENT_COLLECTION));
    t.true(response.data.uri.includes(rkey));
  } finally {
    // Cleanup
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });
    } catch {
      // Ignore
    }
  }
});

test('Creating Posts › should retrieve the created document from PDS', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  const rkey = generateTestTid();

  try {
    const document = {
      $type: 'pub.leaflet.document',
      title: '[TEST] Retrieve Test',
      author: userDid,
      pages: [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{
          block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Test content', facets: [] }
        }]
      }],
      publishedAt: new Date().toISOString()
    };

    await agent.com.atproto.repo.createRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey,
      record: document
    });

    const retrieved = await agent.com.atproto.repo.getRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey
    });

    const value = retrieved.data.value as typeof document;
    t.is(value.title, '[TEST] Retrieve Test');
    t.is(value.author, userDid);
  } finally {
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });
    } catch {
      // Ignore
    }
  }
});

test('Creating Posts › should create multiple documents', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  const rkeys: string[] = [];

  try {
    for (let i = 0; i < 3; i++) {
      const rkey = generateTestTid();
      rkeys.push(rkey);

      await agent.com.atproto.repo.createRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey,
        record: {
          $type: 'pub.leaflet.document',
          title: `[TEST] Multi-doc ${i + 1}`,
          author: userDid,
          pages: [{
            $type: 'pub.leaflet.pages.linearDocument',
            blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: `Content ${i + 1}`, facets: [] } }]
          }],
          publishedAt: new Date().toISOString()
        }
      });
    }

    for (const rkey of rkeys) {
      const record = await agent.com.atproto.repo.getRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });
      t.truthy(record.data.value);
    }
  } finally {
    for (const rkey of rkeys) {
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: userDid,
          collection: LEAFLET_DOCUMENT_COLLECTION,
          rkey
        });
      } catch {
        // Ignore
      }
    }
  }
});

// Indexing/Resyncing tests
test('Indexing › should index documents from PDS to local database', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  const db = createTestDb();
  const rkey = generateTestTid();

  try {
    await agent.com.atproto.repo.createRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey,
      record: {
        $type: 'pub.leaflet.document',
        title: '[TEST] Index Test',
        description: 'Should be indexed',
        author: userDid,
        pages: [{
          $type: 'pub.leaflet.pages.linearDocument',
          blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Indexable content', facets: [] } }]
        }],
        publishedAt: new Date().toISOString()
      }
    });

    db.prepare(`
      INSERT INTO users (did, handle, pds_url)
      VALUES (?, ?, ?)
    `).run(userDid, TEST_HANDLE, agent.pdsUrl?.toString() || 'https://bsky.social');

    const user = db.prepare('SELECT * FROM users WHERE did = ?').get(userDid) as { id: number };

    let cursor: string | undefined;
    let indexed = 0;

    do {
      const response = await agent.com.atproto.repo.listRecords({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        limit: 100,
        cursor
      });

      for (const record of response.data.records) {
        const doc = record.value as { title: string; description?: string; author: string; pages: unknown[]; publishedAt?: string };
        const recordRkey = record.uri.split('/').pop()!;

        if (doc.title?.startsWith('[TEST]')) {
          db.prepare(`
            INSERT INTO documents (uri, user_id, rkey, title, author, content, description, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(uri) DO UPDATE SET
              title = excluded.title,
              content = excluded.content,
              updated_at = CURRENT_TIMESTAMP
          `).run(
            record.uri,
            user.id,
            recordRkey,
            doc.title,
            doc.author,
            JSON.stringify(doc.pages),
            doc.description || null,
            doc.publishedAt || null
          );
          indexed++;
        }
      }

      cursor = response.data.cursor;
    } while (cursor);

    t.true(indexed > 0);

    const localDoc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get(rkey) as { title: string } | undefined;
    t.truthy(localDoc);
    t.is(localDoc?.title, '[TEST] Index Test');
  } finally {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });
    } catch {
      // Ignore
    }
  }
});

test('Indexing › should resync after clearing local database', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  let db = createTestDb();
  const rkey = generateTestTid();
  const uniqueTitle = `[TEST] Resync ${Date.now()}`;

  try {
    await agent.com.atproto.repo.createRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey,
      record: {
        $type: 'pub.leaflet.document',
        title: uniqueTitle,
        author: userDid,
        pages: [{
          $type: 'pub.leaflet.pages.linearDocument',
          blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Resync test', facets: [] } }]
        }],
        publishedAt: new Date().toISOString()
      }
    });

    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      userDid, TEST_HANDLE, agent.pdsUrl?.toString() || 'https://bsky.social'
    );
    const user = db.prepare('SELECT * FROM users WHERE did = ?').get(userDid) as { id: number };

    const record = await agent.com.atproto.repo.getRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey
    });

    const doc = record.data.value as { title: string; author: string; pages: unknown[] };
    db.prepare(`
      INSERT INTO documents (uri, user_id, rkey, title, author, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(record.data.uri, user.id, rkey, doc.title, doc.author, JSON.stringify(doc.pages));

    let localDoc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get(rkey);
    t.truthy(localDoc);

    db.prepare('DELETE FROM documents').run();
    db.prepare('DELETE FROM users').run();

    localDoc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get(rkey);
    t.is(localDoc, undefined);

    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      userDid, TEST_HANDLE, agent.pdsUrl?.toString() || 'https://bsky.social'
    );
    const newUser = db.prepare('SELECT * FROM users WHERE did = ?').get(userDid) as { id: number };

    const reRecord = await agent.com.atproto.repo.getRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey
    });

    const reDoc = reRecord.data.value as { title: string; author: string; pages: unknown[] };
    db.prepare(`
      INSERT INTO documents (uri, user_id, rkey, title, author, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reRecord.data.uri, newUser.id, rkey, reDoc.title, reDoc.author, JSON.stringify(reDoc.pages));

    localDoc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get(rkey) as { title: string };
    t.truthy(localDoc);
    t.is((localDoc as { title: string }).title, uniqueTitle);
  } finally {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });
    } catch {
      // Ignore
    }
  }
});

// Document Updates tests
test('Document Updates › should update an existing document', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  const rkey = generateTestTid();

  try {
    await agent.com.atproto.repo.createRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey,
      record: {
        $type: 'pub.leaflet.document',
        title: '[TEST] Original Title',
        author: userDid,
        pages: [{
          $type: 'pub.leaflet.pages.linearDocument',
          blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Original content', facets: [] } }]
        }],
        publishedAt: new Date().toISOString()
      }
    });

    await agent.com.atproto.repo.putRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey,
      record: {
        $type: 'pub.leaflet.document',
        title: '[TEST] Updated Title',
        author: userDid,
        pages: [{
          $type: 'pub.leaflet.pages.linearDocument',
          blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Updated content', facets: [] } }]
        }],
        publishedAt: new Date().toISOString()
      }
    });

    const record = await agent.com.atproto.repo.getRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey
    });

    const value = record.data.value as { title: string };
    t.is(value.title, '[TEST] Updated Title');
  } finally {
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });
    } catch {
      // Ignore
    }
  }
});

// Document Deletion tests
test('Document Deletion › should delete a document from PDS', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  const rkey = generateTestTid();

  await agent.com.atproto.repo.createRecord({
    repo: userDid,
    collection: LEAFLET_DOCUMENT_COLLECTION,
    rkey,
    record: {
      $type: 'pub.leaflet.document',
      title: '[TEST] To Be Deleted',
      author: userDid,
      pages: [{
        $type: 'pub.leaflet.pages.linearDocument',
        blocks: [{ block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Delete me', facets: [] } }]
      }]
    }
  });

  const beforeDelete = await agent.com.atproto.repo.getRecord({
    repo: userDid,
    collection: LEAFLET_DOCUMENT_COLLECTION,
    rkey
  });
  t.truthy(beforeDelete.data.value);

  await agent.com.atproto.repo.deleteRecord({
    repo: userDid,
    collection: LEAFLET_DOCUMENT_COLLECTION,
    rkey
  });

  await t.throwsAsync(async () => {
    await agent.com.atproto.repo.getRecord({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey
    });
  });
});

// Pagination tests
test('Pagination › should list documents with pagination', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: TEST_HANDLE!,
    password: TEST_APP_PASSWORD!
  });

  const userDid = agent.session!.did;
  const rkeys: string[] = [];

  try {
    for (let i = 0; i < 5; i++) {
      const rkey = generateTestTid();
      rkeys.push(rkey);

      await agent.com.atproto.repo.createRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey,
        record: {
          $type: 'pub.leaflet.document',
          title: `[TEST] Pagination ${i}`,
          author: userDid,
          pages: [{ $type: 'pub.leaflet.pages.linearDocument', blocks: [] }]
        }
      });
    }

    const page1 = await agent.com.atproto.repo.listRecords({
      repo: userDid,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      limit: 2
    });

    t.true(page1.data.records.length <= 2);

    if (page1.data.cursor) {
      const page2 = await agent.com.atproto.repo.listRecords({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        limit: 2,
        cursor: page1.data.cursor
      });

      t.true(page2.data.records.length > 0);
    }
  } finally {
    for (const rkey of rkeys) {
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: userDid,
          collection: LEAFLET_DOCUMENT_COLLECTION,
          rkey
        });
      } catch {
        // Ignore
      }
    }
  }
});

// CSRF Protection tests
test('CSRF Protection › should generate unique CSRF tokens', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const { generateCsrfToken } = await import('./middleware/csrf.js');

  const token1 = generateCsrfToken('session1');
  const token2 = generateCsrfToken('session2');

  t.not(token1, token2);
  t.is(token1.length, 64); // 32 bytes hex
});

test('CSRF Protection › should validate correct CSRF tokens', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const { generateCsrfToken, validateCsrfToken } = await import('./middleware/csrf.js');

  const sessionToken = 'test-session-csrf';
  const csrfToken = generateCsrfToken(sessionToken);

  t.true(validateCsrfToken(sessionToken, csrfToken));
});

test('CSRF Protection › should reject invalid CSRF tokens', async t => {
  if (skipIfNoCredentials) {
    t.pass('Skipped: no credentials');
    return;
  }

  const { generateCsrfToken, validateCsrfToken } = await import('./middleware/csrf.js');

  const sessionToken = 'test-session-invalid';
  generateCsrfToken(sessionToken);

  t.false(validateCsrfToken(sessionToken, 'wrong-token'));
  t.false(validateCsrfToken('other-session', 'any-token'));
});
