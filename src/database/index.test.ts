import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from './schema.js';

// Use in-memory database for testing
function createTestDb() {
  const db = new Database(':memory:');
  initializeDatabase(db);
  return db;
}

describe('Database Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe('Users table', () => {
    it('should create a user', () => {
      const stmt = db.prepare(`
        INSERT INTO users (did, handle, pds_url, display_name)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run('did:plc:test123', 'testuser.bsky.social', 'https://bsky.social', 'Test User');

      const user = db.prepare('SELECT * FROM users WHERE did = ?').get('did:plc:test123') as Record<string, unknown>;
      expect(user).toBeDefined();
      expect(user.handle).toBe('testuser.bsky.social');
      expect(user.display_name).toBe('Test User');
    });

    it('should enforce unique DID constraint', () => {
      const stmt = db.prepare(`
        INSERT INTO users (did, handle, pds_url)
        VALUES (?, ?, ?)
      `);
      stmt.run('did:plc:unique', 'user1.bsky.social', 'https://bsky.social');

      expect(() => {
        stmt.run('did:plc:unique', 'user2.bsky.social', 'https://bsky.social');
      }).toThrow();
    });

    it('should update handle correctly', () => {
      const insertStmt = db.prepare(`
        INSERT INTO users (did, handle, pds_url)
        VALUES (?, ?, ?)
      `);
      insertStmt.run('did:plc:handletest', 'old.bsky.social', 'https://bsky.social');

      const updateStmt = db.prepare('UPDATE users SET handle = ? WHERE did = ?');
      const result = updateStmt.run('new.bsky.social', 'did:plc:handletest');
      expect(result.changes).toBe(1);

      const user = db.prepare('SELECT handle FROM users WHERE did = ?').get('did:plc:handletest') as { handle: string };
      expect(user.handle).toBe('new.bsky.social');
    });
  });

  describe('Sessions table', () => {
    it('should create a session linked to a user', () => {
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
      expect(session).toBeDefined();
      expect(session.user_id).toBe(user.id);
    });

    it('should cascade delete sessions when user is deleted', () => {
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
      expect(session).toBeUndefined();
    });
  });

  describe('Documents table', () => {
    let userId: number;

    beforeEach(() => {
      db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
        'did:plc:docuser', 'docuser.bsky.social', 'https://bsky.social'
      );
      const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:docuser') as { id: number };
      userId = user.id;
    });

    it('should create a document', () => {
      db.prepare(`
        INSERT INTO documents (uri, user_id, rkey, title, author, content)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'at://did:plc:docuser/pub.leaflet.document/abc123',
        userId,
        'abc123',
        'Test Post',
        'did:plc:docuser',
        '[]'
      );

      const doc = db.prepare('SELECT * FROM documents WHERE rkey = ?').get('abc123') as Record<string, unknown>;
      expect(doc).toBeDefined();
      expect(doc.title).toBe('Test Post');
    });

    it('should upsert documents (update on conflict)', () => {
      const uri = 'at://did:plc:docuser/pub.leaflet.document/upsert123';

      db.prepare(`
        INSERT INTO documents (uri, user_id, rkey, title, author, content)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(uri) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updated_at = CURRENT_TIMESTAMP
      `).run(uri, userId, 'upsert123', 'Original Title', 'did:plc:docuser', '[]');

      // Upsert with new title
      db.prepare(`
        INSERT INTO documents (uri, user_id, rkey, title, author, content)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(uri) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updated_at = CURRENT_TIMESTAMP
      `).run(uri, userId, 'upsert123', 'Updated Title', 'did:plc:docuser', '[{"test": true}]');

      const doc = db.prepare('SELECT * FROM documents WHERE uri = ?').get(uri) as Record<string, unknown>;
      expect(doc.title).toBe('Updated Title');
      expect(doc.content).toBe('[{"test": true}]');
    });

    it('should enforce unique URI constraint', () => {
      const uri = 'at://did:plc:docuser/pub.leaflet.document/unique123';

      db.prepare(`
        INSERT INTO documents (uri, user_id, rkey, title, author, content)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uri, userId, 'unique123', 'First', 'did:plc:docuser', '[]');

      expect(() => {
        db.prepare(`
          INSERT INTO documents (uri, user_id, rkey, title, author, content)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(uri, userId, 'unique123', 'Second', 'did:plc:docuser', '[]');
      }).toThrow();
    });

    it('should cascade delete documents when user is deleted', () => {
      const uri = 'at://did:plc:docuser/pub.leaflet.document/cascadedoc';

      db.prepare(`
        INSERT INTO documents (uri, user_id, rkey, title, author, content)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uri, userId, 'cascadedoc', 'Cascade Test', 'did:plc:docuser', '[]');

      db.prepare('DELETE FROM users WHERE id = ?').run(userId);

      const doc = db.prepare('SELECT * FROM documents WHERE uri = ?').get(uri);
      expect(doc).toBeUndefined();
    });
  });

  describe('Publications table', () => {
    let userId: number;

    beforeEach(() => {
      db.prepare(`INSERT INTO users (did, handle, pds_url) VALUES (?, ?, ?)`).run(
        'did:plc:pubuser', 'pubuser.bsky.social', 'https://bsky.social'
      );
      const user = db.prepare('SELECT id FROM users WHERE did = ?').get('did:plc:pubuser') as { id: number };
      userId = user.id;
    });

    it('should create a publication', () => {
      db.prepare(`
        INSERT INTO publications (uri, user_id, rkey, name, description, base_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'at://did:plc:pubuser/pub.leaflet.publication/mypub',
        userId,
        'mypub',
        'My Publication',
        'A test publication',
        '/blog'
      );

      const pub = db.prepare('SELECT * FROM publications WHERE rkey = ?').get('mypub') as Record<string, unknown>;
      expect(pub).toBeDefined();
      expect(pub.name).toBe('My Publication');
      expect(pub.base_path).toBe('/blog');
    });
  });

  describe('Indices', () => {
    it('should have created all expected indices', () => {
      const indices = db.prepare(`
        SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'
      `).all() as { name: string }[];

      const indexNames = indices.map(i => i.name);
      expect(indexNames).toContain('idx_documents_user_id');
      expect(indexNames).toContain('idx_documents_published_at');
      expect(indexNames).toContain('idx_sessions_token');
      expect(indexNames).toContain('idx_sessions_expires');
      expect(indexNames).toContain('idx_users_did');
      expect(indexNames).toContain('idx_users_handle');
    });
  });

  describe('Jetstream state table', () => {
    it('should have jetstream_state table with initial row', () => {
      const row = db.prepare('SELECT * FROM jetstream_state WHERE id = 1').get() as { id: number; cursor: string | null };
      expect(row).toBeDefined();
      expect(row.id).toBe(1);
      expect(row.cursor).toBeNull();
    });

    it('should update cursor value', () => {
      const cursor = '1234567890123456';
      db.prepare('UPDATE jetstream_state SET cursor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(cursor);

      const row = db.prepare('SELECT cursor FROM jetstream_state WHERE id = 1').get() as { cursor: string };
      expect(row.cursor).toBe(cursor);
    });

    it('should enforce single row constraint', () => {
      expect(() => {
        db.prepare('INSERT INTO jetstream_state (id, cursor) VALUES (2, NULL)').run();
      }).toThrow();
    });

    it('should allow updating cursor multiple times', () => {
      db.prepare('UPDATE jetstream_state SET cursor = ? WHERE id = 1').run('cursor1');
      db.prepare('UPDATE jetstream_state SET cursor = ? WHERE id = 1').run('cursor2');
      db.prepare('UPDATE jetstream_state SET cursor = ? WHERE id = 1').run('cursor3');

      const row = db.prepare('SELECT cursor FROM jetstream_state WHERE id = 1').get() as { cursor: string };
      expect(row.cursor).toBe('cursor3');
    });
  });
});
