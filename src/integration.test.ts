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

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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

describe.skipIf(!hasCredentials)('ATProto Integration Tests', () => {
  let agent: AtpAgent;
  let userDid: string;
  let db: Database.Database;

  // Track created test documents for cleanup
  const createdRkeys: string[] = [];

  beforeAll(async () => {
    // Login to ATProto
    agent = new AtpAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: TEST_HANDLE!,
      password: TEST_APP_PASSWORD!
    });

    userDid = agent.session!.did;
    console.log(`Logged in as ${TEST_HANDLE} (${userDid})`);

    // Clean up any leftover test documents from previous runs
    const cleaned = await deleteTestDocuments(agent, userDid);
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} leftover test documents`);
    }
  });

  afterAll(async () => {
    // Clean up all test documents created during tests
    for (const rkey of createdRkeys) {
      try {
        await agent.com.atproto.repo.deleteRecord({
          repo: userDid,
          collection: LEAFLET_DOCUMENT_COLLECTION,
          rkey
        });
      } catch {
        // Ignore deletion errors
      }
    }

    // Close and remove test database
    if (db) {
      db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  beforeEach(() => {
    // Fresh database for each test
    if (db) {
      db.close();
    }
    db = createTestDb();
  });

  describe('Authentication', () => {
    it('should authenticate with real ATProto credentials', async () => {
      expect(agent.session).toBeDefined();
      expect(agent.session?.did).toMatch(/^did:(plc|web):/);
      expect(agent.session?.handle).toBe(TEST_HANDLE);
    });

    it('should get user profile', async () => {
      const profile = await agent.getProfile({ actor: userDid });
      expect(profile.data.did).toBe(userDid);
      expect(profile.data.handle).toBe(TEST_HANDLE);
    });

    it('should resolve PDS URL', () => {
      expect(agent.pdsUrl).toBeDefined();
    });
  });

  describe('Creating Posts', () => {
    it('should create a Leaflet document on the PDS', async () => {
      const rkey = generateTestTid();
      createdRkeys.push(rkey);

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

      expect(response.data.uri).toContain(userDid);
      expect(response.data.uri).toContain(LEAFLET_DOCUMENT_COLLECTION);
      expect(response.data.uri).toContain(rkey);
    });

    it('should retrieve the created document from PDS', async () => {
      const rkey = generateTestTid();
      createdRkeys.push(rkey);

      // Create document
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

      // Retrieve it
      const retrieved = await agent.com.atproto.repo.getRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });

      const value = retrieved.data.value as typeof document;
      expect(value.title).toBe('[TEST] Retrieve Test');
      expect(value.author).toBe(userDid);
    });

    it('should create multiple documents', async () => {
      const rkeys: string[] = [];

      for (let i = 0; i < 3; i++) {
        const rkey = generateTestTid();
        rkeys.push(rkey);
        createdRkeys.push(rkey);

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

      // Verify all exist
      for (const rkey of rkeys) {
        const record = await agent.com.atproto.repo.getRecord({
          repo: userDid,
          collection: LEAFLET_DOCUMENT_COLLECTION,
          rkey
        });
        expect(record.data.value).toBeDefined();
      }
    });

    it('should create a rich document with all block types', async () => {
      const rkey = generateTestTid();
      createdRkeys.push(rkey);

      // Create a document with all supported Leaflet block types
      const document = {
        $type: 'pub.leaflet.document',
        title: '[TEST] Rich Document with All Block Types',
        description: 'Testing all Leaflet block types',
        author: userDid,
        pages: [{
          $type: 'pub.leaflet.pages.linearDocument',
          id: crypto.randomUUID(),
          blocks: [
            // Text block with facets (bold, italic, link)
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.text',
                plaintext: 'This is a text block with bold and italic formatting and a link.',
                facets: [
                  {
                    index: { byteStart: 27, byteEnd: 31 },
                    features: [{ $type: 'pub.leaflet.richtext.facet#bold' }]
                  },
                  {
                    index: { byteStart: 36, byteEnd: 42 },
                    features: [{ $type: 'pub.leaflet.richtext.facet#italic' }]
                  },
                  {
                    index: { byteStart: 58, byteEnd: 62 },
                    features: [{
                      $type: 'pub.leaflet.richtext.facet#link',
                      uri: 'https://example.com'
                    }]
                  }
                ]
              }
            },
            // Header block (h2)
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.header',
                plaintext: 'This is a Header',
                level: 2,
                facets: []
              }
            },
            // Blockquote
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.blockquote',
                plaintext: 'This is a blockquote with some wise words.',
                facets: []
              }
            },
            // Code block
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.code',
                plaintext: 'const greeting = "Hello, Leaflet!";\nconsole.log(greeting);',
                language: 'javascript'
              }
            },
            // Horizontal rule
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.horizontalRule'
              }
            },
            // Unordered list - uses 'children' not 'items' per Leaflet lexicon
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.unorderedList',
                children: [
                  {
                    content: {
                      $type: 'pub.leaflet.blocks.text',
                      plaintext: 'First list item',
                      facets: []
                    }
                  },
                  {
                    content: {
                      $type: 'pub.leaflet.blocks.text',
                      plaintext: 'Second list item with nested items',
                      facets: []
                    },
                    children: [
                      {
                        content: {
                          $type: 'pub.leaflet.blocks.text',
                          plaintext: 'Nested item 1',
                          facets: []
                        }
                      },
                      {
                        content: {
                          $type: 'pub.leaflet.blocks.text',
                          plaintext: 'Nested item 2',
                          facets: []
                        }
                      }
                    ]
                  },
                  {
                    content: {
                      $type: 'pub.leaflet.blocks.text',
                      plaintext: 'Third list item',
                      facets: []
                    }
                  }
                ]
              }
            },
            // Website embed
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.website',
                src: 'https://atproto.com',
                title: 'AT Protocol',
                description: 'The AT Protocol is a networking technology for building open social apps.'
              }
            },
            // Bluesky post embed (using strongRef format)
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.bskyPost',
                postRef: {
                  uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l2s5xxv2ze2c',
                  cid: 'bafyreibe4yinjgvdvvhljbeti5lhvgo7guj6y2ij3z5vmnp7yaz5swnm6q'
                }
              }
            },
            // Math block (LaTeX)
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.math',
                tex: 'E = mc^2'
              }
            },
            // Button block
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.button',
                text: 'Visit Leaflet',
                url: 'https://leaflet.pub'
              }
            },
            // Final text block
            {
              $type: 'pub.leaflet.pages.linearDocument#block',
              block: {
                $type: 'pub.leaflet.blocks.text',
                plaintext: 'This document contains examples of all major Leaflet block types!',
                facets: []
              }
            }
          ]
        }],
        tags: ['test', 'rich-document', 'all-blocks'],
        publishedAt: new Date().toISOString()
      };

      const response = await agent.com.atproto.repo.createRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey,
        record: document
      });

      expect(response.data.uri).toContain(userDid);
      expect(response.data.cid).toBeDefined();

      // Retrieve and verify
      const retrieved = await agent.com.atproto.repo.getRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });

      const value = retrieved.data.value as typeof document;
      expect(value.title).toBe('[TEST] Rich Document with All Block Types');
      expect(value.pages[0].blocks.length).toBe(11);
      expect(value.tags).toContain('rich-document');

      console.log(`Created rich document: https://leaflet.pub/p/${userDid}/${rkey}`);
    });
  });

  describe('Indexing/Resyncing', () => {
    it('should index documents from PDS to local database', async () => {
      // Create a document on PDS
      const rkey = generateTestTid();
      createdRkeys.push(rkey);

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

      // Create user in local DB
      db.prepare(`
        INSERT INTO users (did, handle, pds_url)
        VALUES (?, ?, ?)
      `).run(userDid, TEST_HANDLE, agent.pdsUrl?.toString() || 'https://bsky.social');

      const user = db.prepare('SELECT * FROM users WHERE did = ?').get(userDid) as { id: number };

      // Index from PDS
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

          // Only index test documents
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

      expect(indexed).toBeGreaterThan(0);

      // Verify document is in local DB
      const localDoc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get(rkey) as { title: string } | undefined;
      expect(localDoc).toBeDefined();
      expect(localDoc?.title).toBe('[TEST] Index Test');
    });

    it('should resync after clearing local database', async () => {
      // Create a document on PDS
      const rkey = generateTestTid();
      createdRkeys.push(rkey);
      const uniqueTitle = `[TEST] Resync ${Date.now()}`;

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

      // First sync
      db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
        userDid, TEST_HANDLE, agent.pdsUrl?.toString() || 'https://bsky.social'
      );
      const user = db.prepare('SELECT * FROM users WHERE did = ?').get(userDid) as { id: number };

      // Index the document
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

      // Verify it exists
      let localDoc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get(rkey);
      expect(localDoc).toBeDefined();

      // Clear the database (simulating a resync)
      db.prepare('DELETE FROM documents').run();
      db.prepare('DELETE FROM users').run();

      // Verify it's gone
      localDoc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get(rkey);
      expect(localDoc).toBeUndefined();

      // Re-create user and resync
      db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
        userDid, TEST_HANDLE, agent.pdsUrl?.toString() || 'https://bsky.social'
      );
      const newUser = db.prepare('SELECT * FROM users WHERE did = ?').get(userDid) as { id: number };

      // Re-index from PDS
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

      // Verify document is back
      localDoc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get(rkey) as { title: string };
      expect(localDoc).toBeDefined();
      expect((localDoc as { title: string }).title).toBe(uniqueTitle);
    });
  });

  describe('Document Updates', () => {
    it('should update an existing document', async () => {
      const rkey = generateTestTid();
      createdRkeys.push(rkey);

      // Create initial document
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

      // Update the document
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

      // Verify the update
      const record = await agent.com.atproto.repo.getRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });

      const value = record.data.value as { title: string };
      expect(value.title).toBe('[TEST] Updated Title');
    });
  });

  describe('Document Deletion', () => {
    it('should delete a document from PDS', async () => {
      const rkey = generateTestTid();
      // Don't add to createdRkeys since we're deleting it

      // Create document
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

      // Verify it exists
      const beforeDelete = await agent.com.atproto.repo.getRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });
      expect(beforeDelete.data.value).toBeDefined();

      // Delete it
      await agent.com.atproto.repo.deleteRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });

      // Verify it's gone
      await expect(agent.com.atproto.repo.getRecord({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      })).rejects.toThrow();
    });
  });

  describe('Pagination', () => {
    it('should list documents with pagination', async () => {
      // Create several documents
      const rkeys: string[] = [];
      for (let i = 0; i < 5; i++) {
        const rkey = generateTestTid();
        rkeys.push(rkey);
        createdRkeys.push(rkey);

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

      // List with small limit to test pagination
      const page1 = await agent.com.atproto.repo.listRecords({
        repo: userDid,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        limit: 2
      });

      expect(page1.data.records.length).toBeLessThanOrEqual(2);

      if (page1.data.cursor) {
        const page2 = await agent.com.atproto.repo.listRecords({
          repo: userDid,
          collection: LEAFLET_DOCUMENT_COLLECTION,
          limit: 2,
          cursor: page1.data.cursor
        });

        expect(page2.data.records.length).toBeGreaterThan(0);
      }
    });
  });
});

describe.skipIf(!hasCredentials)('CSRF Protection', () => {
  it('should generate unique CSRF tokens', async () => {
    const { generateCsrfToken } = await import('./middleware/csrf.js');

    const token1 = generateCsrfToken('session1');
    const token2 = generateCsrfToken('session2');

    expect(token1).not.toBe(token2);
    expect(token1).toHaveLength(64); // 32 bytes hex
  });

  it('should validate correct CSRF tokens', async () => {
    const { generateCsrfToken, validateCsrfToken } = await import('./middleware/csrf.js');

    const sessionToken = 'test-session-csrf';
    const csrfToken = generateCsrfToken(sessionToken);

    expect(validateCsrfToken(sessionToken, csrfToken)).toBe(true);
  });

  it('should reject invalid CSRF tokens', async () => {
    const { generateCsrfToken, validateCsrfToken } = await import('./middleware/csrf.js');

    const sessionToken = 'test-session-invalid';
    generateCsrfToken(sessionToken);

    expect(validateCsrfToken(sessionToken, 'wrong-token')).toBe(false);
    expect(validateCsrfToken('other-session', 'any-token')).toBe(false);
  });
});

// Log skip reason if credentials not provided
if (!hasCredentials) {
  console.log('Skipping ATProto integration tests: TEST_HANDLE and TEST_APP_PASSWORD not set in environment');
}
