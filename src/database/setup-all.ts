import 'dotenv/config';
import { AtpAgent } from '@atproto/api';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './schema.js';
import { indexUserPDS } from '../services/indexer.js';

const TABLES_TO_CLEAR = [
  'documents',
  'publications',
  'sessions',
  'oauth_state',
  'oauth_sessions',
  'users',
];

const LEAFLET_DOCUMENT_COLLECTION = 'pub.leaflet.document';
const LEAFLET_PUBLICATION_COLLECTION = 'pub.leaflet.publication';

async function deleteAllRecordsFromCollection(
  agent: AtpAgent,
  did: string,
  collection: string
): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;
  const recordsToDelete: string[] = [];

  // First, collect all record keys
  do {
    try {
      const response = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection,
        limit: 100,
        cursor,
      });

      for (const record of response.data.records) {
        const rkey = record.uri.split('/').pop()!;
        recordsToDelete.push(rkey);
      }

      cursor = response.data.cursor;
    } catch (error: unknown) {
      // Collection might not exist, that's okay
      if (error && typeof error === 'object' && 'status' in error && error.status === 400) {
        break;
      }
      throw error;
    }
  } while (cursor);

  // Now delete each record
  for (const rkey of recordsToDelete) {
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: did,
        collection,
        rkey,
      });
      deleted++;
      console.log(`  - Deleted ${collection}/${rkey}`);
    } catch (error) {
      console.error(`  - Failed to delete ${collection}/${rkey}:`, error);
    }
  }

  return deleted;
}

async function main() {
  const testHandle = process.env.TEST_HANDLE;
  const testAppPassword = process.env.TEST_APP_PASSWORD;

  if (!testHandle || !testAppPassword) {
    console.error('Error: TEST_HANDLE and TEST_APP_PASSWORD must be set in .env');
    console.error('These credentials are used to delete records and re-index lexicons after database reset.');
    process.exit(1);
  }

  console.log('\n=== FULL RESET: This will delete ALL Leaflet data from PDS and local database ===\n');

  // Authenticate first to delete PDS records
  console.log('Authenticating with test user...');
  const handle = testHandle.startsWith('@') ? testHandle.slice(1) : testHandle;

  const agent = new AtpAgent({ service: 'https://bsky.social' });

  try {
    await agent.login({ identifier: handle, password: testAppPassword });
  } catch (error) {
    console.error('Failed to authenticate:', error);
    process.exit(1);
  }

  if (!agent.session) {
    console.error('Failed to create session');
    process.exit(1);
  }

  const did = agent.session.did;
  const pdsUrl = agent.pdsUrl?.toString() || 'https://bsky.social';

  console.log(`Authenticated as: ${handle} (${did})`);
  console.log(`PDS URL: ${pdsUrl}`);

  // Delete all Leaflet records from PDS
  console.log('\nDeleting all Leaflet documents from PDS...');
  const docsDeleted = await deleteAllRecordsFromCollection(agent, did, LEAFLET_DOCUMENT_COLLECTION);
  console.log(`Deleted ${docsDeleted} documents from PDS`);

  console.log('\nDeleting all Leaflet publications from PDS...');
  const pubsDeleted = await deleteAllRecordsFromCollection(agent, did, LEAFLET_PUBLICATION_COLLECTION);
  console.log(`Deleted ${pubsDeleted} publications from PDS`);

  // Now proceed with local database reset
  const dbPath = process.env.DATABASE_PATH || './data/app.db';
  console.log(`\nUsing database at: ${dbPath}`);

  // Ensure data directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }

  // Open database connection
  const db = new Database(dbPath);
  initializeDatabase(db);
  console.log('Database initialized with schema.');

  // Clear all tables (in order to respect foreign key constraints)
  console.log('\nClearing database tables...');
  for (const table of TABLES_TO_CLEAR) {
    try {
      const result = db.prepare(`DELETE FROM ${table}`).run();
      console.log(`  - Cleared ${table}: ${result.changes} rows deleted`);
    } catch (error) {
      console.log(`  - Table ${table}: already empty or doesn't exist`);
    }
  }

  // Reset jetstream cursor to start fresh
  db.prepare('UPDATE jetstream_state SET cursor = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run();
  console.log('  - Reset jetstream cursor');

  // Get profile for display name
  let displayName: string | undefined;
  try {
    const profile = await agent.getProfile({ actor: did });
    displayName = profile.data.displayName;
  } catch {
    // Profile fetch failed, continue without display name
  }

  // Create user in database
  const createUserStmt = db.prepare(`
    INSERT INTO users (did, handle, pds_url, display_name)
    VALUES (?, ?, ?, ?)
  `);
  createUserStmt.run(did, handle, pdsUrl, displayName || null);

  const user = db.prepare('SELECT * FROM users WHERE did = ?').get(did) as {
    id: number;
    did: string;
    handle: string;
    display_name: string | null;
    pds_url: string;
    created_at: string;
    last_indexed_at: string | null;
  };

  console.log(`Created user: ${user.handle} (ID: ${user.id})`);

  // Close database before indexing (indexer uses its own connection)
  db.close();

  // Index user's PDS to fetch all lexicons (should be empty now)
  console.log('\nIndexing user PDS for Leaflet documents and publications...');
  try {
    const result = await indexUserPDS(user, agent);
    console.log(`\nIndexing complete:`);
    console.log(`  - Documents: ${result.documents}`);
    console.log(`  - Publications: ${result.publications}`);
    console.log(`  - Deleted orphans: ${result.deleted}`);
  } catch (error) {
    console.error('Failed to index PDS:', error);
    process.exit(1);
  }

  console.log('\nFull database reset complete! All Leaflet data has been removed from PDS and local database.');
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
