import test, { ExecutionContext } from 'ava';
import Database from 'better-sqlite3';
import { initializeDatabase } from './schema.js';

// Use in-memory database for testing
function createTestDb() {
  const db = new Database(':memory:');
  initializeDatabase(db);
  return db;
}

// Helper to create and close db for each test
function withTestDb(t: ExecutionContext, fn: (db: Database.Database) => void) {
  const db = createTestDb();
  try {
    fn(db);
  } finally {
    db.close();
  }
}

// Users table tests
test('Users table › should create a user', t => {
  withTestDb(t, db => {
    const stmt = db.prepare(`
      INSERT INTO users (did, handle, pds_url, display_name)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('did:plc:test123', 'testuser.bsky.social', 'https://bsky.social', 'Test User');

    const user = db.prepare('SELECT * FROM users WHERE did = ?').get('did:plc:test123') as Record<string, unknown>;
    t.truthy(user);
    t.is(user.handle, 'testuser.bsky.social');
    t.is(user.display_name, 'Test User');
  });
});

test('Users table › should enforce unique DID constraint', t => {
  withTestDb(t, db => {
    const stmt = db.prepare(`
      INSERT INTO users (did, handle, pds_url)
      VALUES (?, ?, ?)
    `);
    stmt.run('did:plc:unique', 'user1.bsky.social', 'https://bsky.social');

    const error = t.throws(() => {
      stmt.run('did:plc:unique', 'user2.bsky.social', 'https://bsky.social');
    }, { any: true });
    t.truthy(error);
  });
});

test('Users table › should update handle correctly', t => {
  withTestDb(t, db => {
    const insertStmt = db.prepare(`
      INSERT INTO users (did, handle, pds_url)
      VALUES (?, ?, ?)
    `);
    insertStmt.run('did:plc:handletest', 'old.bsky.social', 'https://bsky.social');

    const updateStmt = db.prepare('UPDATE users SET handle = ? WHERE did = ?');
    const result = updateStmt.run('new.bsky.social', 'did:plc:handletest');
    t.is(result.changes, 1);

    const user = db.prepare('SELECT handle FROM users WHERE did = ?').get('did:plc:handletest') as { handle: string };
    t.is(user.handle, 'new.bsky.social');
  });
});

// Sessions table tests
test('Sessions table › should create a session linked to a user', t => {
  withTestDb(t, db => {
    // First create a user
    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      'did:plc:session', 'sessionuser.bsky.social', 'https://bsky.social'
    );
    const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:session') as { id: number };

    // Create session
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    db.prepare(`
      INSERT INTO sessions (user_id, session_token, access_jwt, refresh_jwt, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, 'test-token-123', 'access-jwt', 'refresh-jwt', expiresAt);

    const session = db.prepare('SELECT * FROM sessions WHERE session_token = ?').get('test-token-123') as Record<string, unknown>;
    t.truthy(session);
    t.is(session.user_id, user.id);
  });
});

test('Sessions table › should cascade delete sessions when user is deleted', t => {
  withTestDb(t, db => {
    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      'did:plc:cascade', 'cascade.bsky.social', 'https://bsky.social'
    );
    const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:cascade') as { id: number };

    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    db.prepare(`
      INSERT INTO sessions (user_id, session_token, access_jwt, refresh_jwt, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, 'cascade-token', 'jwt', 'jwt', expiresAt);

    // Delete user
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    // Session should be gone
    const session = db.prepare('SELECT * FROM sessions WHERE session_token = ?').get('cascade-token');
    t.is(session, undefined);
  });
});

// Documents table tests
test('Documents table › should create a document', t => {
  withTestDb(t, db => {
    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      'did:plc:docuser', 'docuser.bsky.social', 'https://bsky.social'
    );
    const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:docuser') as { id: number };

    db.prepare(`
      INSERT INTO documents (uri, user_id, rkey, title, author, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'at://did:plc:docuser/pub.leaflet.document/abc123',
      user.id,
      'abc123',
      'Test Post',
      'did:plc:docuser',
      '[]'
    );

    const doc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get('abc123') as Record<string, unknown>;
    t.truthy(doc);
    t.is(doc.title, 'Test Post');
  });
});

test('Documents table › should upsert documents (update on conflict)', t => {
  withTestDb(t, db => {
    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      'did:plc:docuser', 'docuser.bsky.social', 'https://bsky.social'
    );
    const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:docuser') as { id: number };
    const uri = 'at://did:plc:docuser/pub.leaflet.document/upsert123';

    db.prepare(`
      INSERT INTO documents (uri, user_id, rkey, title, author, content)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(uri) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        updated_at = CURRENT_TIMESTAMP
    `).run(uri, user.id, 'upsert123', 'Original Title', 'did:plc:docuser', '[]');

    // Upsert with new title
    db.prepare(`
      INSERT INTO documents (uri, user_id, rkey, title, author, content)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(uri) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        updated_at = CURRENT_TIMESTAMP
    `).run(uri, user.id, 'upsert123', 'Updated Title', 'did:plc:docuser', '[{"test": true}]');

    const doc = db.prepare('SELECT * FROM documents WHERE uri = ?').get(uri) as Record<string, unknown>;
    t.is(doc.title, 'Updated Title');
    t.is(doc.content, '[{"test": true}]');
  });
});

test('Documents table › should enforce unique URI constraint', t => {
  withTestDb(t, db => {
    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      'did:plc:docuser', 'docuser.bsky.social', 'https://bsky.social'
    );
    const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:docuser') as { id: number };
    const uri = 'at://did:plc:docuser/pub.leaflet.document/unique123';

    db.prepare(`
      INSERT INTO documents (uri, user_id, rkey, title, author, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uri, user.id, 'unique123', 'First', 'did:plc:docuser', '[]');

    const error = t.throws(() => {
      db.prepare(`
        INSERT INTO documents (uri, user_id, rkey, title, author, content)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uri, user.id, 'unique123', 'Second', 'did:plc:docuser', '[]');
    }, { any: true });
    t.truthy(error);
  });
});

test('Documents table › should cascade delete documents when user is deleted', t => {
  withTestDb(t, db => {
    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      'did:plc:docuser', 'docuser.bsky.social', 'https://bsky.social'
    );
    const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:docuser') as { id: number };
    const uri = 'at://did:plc:docuser/pub.leaflet.document/cascadedoc';

    db.prepare(`
      INSERT INTO documents (uri, user_id, rkey, title, author, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uri, user.id, 'cascadedoc', 'Cascade Test', 'did:plc:docuser', '[]');

    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    const doc = db.prepare('SELECT * FROM documents WHERE uri = ?').get(uri);
    t.is(doc, undefined);
  });
});

// Publications table tests
test('Publications table › should create a publication', t => {
  withTestDb(t, db => {
    db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
      'did:plc:pubuser', 'pubuser.bsky.social', 'https://bsky.social'
    );
    const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:pubuser') as { id: number };

    db.prepare(`
      INSERT INTO publications (uri, user_id, rkey, name, description, base_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'at://did:plc:pubuser/pub.leaflet.publication/mypub',
      user.id,
      'mypub',
      'My Publication',
      'A test publication',
      '/blog'
    );

    const pub = db.prepare('SELECT * FROM publications WHERE rkey = ?').get('mypub') as Record<string, unknown>;
    t.truthy(pub);
    t.is(pub.name, 'My Publication');
    t.is(pub.base_path, '/blog');
  });
});

// Indices tests
test('Indices › should have created all expected indices', t => {
  withTestDb(t, db => {
    const indices = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'
    `).all() as { name: string }[];

    const indexNames = indices.map(i => i.name);
    t.true(indexNames.includes('idx_documents_user_id'));
    t.true(indexNames.includes('idx_documents_published_at'));
    t.true(indexNames.includes('idx_sessions_token'));
    t.true(indexNames.includes('idx_sessions_expires'));
    t.true(indexNames.includes('idx_users_did'));
    t.true(indexNames.includes('idx_users_handle'));
  });
});

// Jetstream state table tests
test('Jetstream state table › should have jetstream_state table with initial row', t => {
  withTestDb(t, db => {
    const row = db.prepare('SELECT * FROM jetstream_state WHERE id = 1').get() as { id: number; cursor: string | null };
    t.truthy(row);
    t.is(row.id, 1);
    t.is(row.cursor, null);
  });
});

test('Jetstream state table › should update cursor value', t => {
  withTestDb(t, db => {
    const cursor = '1234567890123456';
    db.prepare('UPDATE jetstream_state SET cursor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(cursor);

    const row = db.prepare('SELECT cursor FROM jetstream_state WHERE id = 1').get() as { cursor: string };
    t.is(row.cursor, cursor);
  });
});

test('Jetstream state table › should enforce single row constraint', t => {
  withTestDb(t, db => {
    const error = t.throws(() => {
      db.prepare('INSERT INTO jetstream_state (id, cursor) VALUES (2, NULL)').run();
    }, { any: true });
    t.truthy(error);
  });
});

test('Jetstream state table › should allow updating cursor multiple times', t => {
  withTestDb(t, db => {
    db.prepare('UPDATE jetstream_state SET cursor = ? WHERE id = 1').run('cursor1');
    db.prepare('UPDATE jetstream_state SET cursor = ? WHERE id = 1').run('cursor2');
    db.prepare('UPDATE jetstream_state SET cursor = ? WHERE id = 1').run('cursor3');

    const row = db.prepare('SELECT cursor FROM jetstream_state WHERE id = 1').get() as { cursor: string };
    t.is(row.cursor, 'cursor3');
  });
});
