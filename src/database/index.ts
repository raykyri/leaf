import Database from 'better-sqlite3';
import { initializeDatabase } from './schema.js';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || './data/app.db';

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);
    initializeDatabase(db);
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// User operations
export interface User {
  id: number;
  did: string;
  handle: string;
  display_name: string | null;
  pds_url: string;
  created_at: string;
  last_indexed_at: string | null;
}

export function createUser(did: string, handle: string, pdsUrl: string, displayName?: string): User {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO users (did, handle, pds_url, display_name)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(did, handle, pdsUrl, displayName || null);
  return getUserByDid(did)!;
}

export function getUserByDid(did: string): User | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM users WHERE did = ?');
  return stmt.get(did) as User | null;
}

export function getUserByHandle(handle: string): User | null {
  const db = getDatabase();
  // Handle can start with @ or not
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  const stmt = db.prepare('SELECT * FROM users WHERE handle = ? OR handle = ?');
  return stmt.get(normalizedHandle, '@' + normalizedHandle) as User | null;
}

export function getUserById(id: number): User | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as User | null;
}

export function getAllUserDids(): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT did FROM users');
  const rows = stmt.all() as { did: string }[];
  return rows.map(r => r.did);
}

export function updateUserLastIndexed(userId: number): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE users SET last_indexed_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(userId);
}

export function updateUserHandle(did: string, newHandle: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE users SET handle = ? WHERE did = ?');
  const result = stmt.run(newHandle, did);
  return result.changes > 0;
}

export function updateUserDisplayName(userId: number, displayName: string | null): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE users SET display_name = ? WHERE id = ?');
  const result = stmt.run(displayName, userId);
  return result.changes > 0;
}

// Session operations
export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  access_jwt: string | null;
  refresh_jwt: string | null;
  expires_at: string;
  created_at: string;
}

export function createSession(userId: number, sessionToken: string, accessJwt: string, refreshJwt: string): Session {
  const db = getDatabase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  const stmt = db.prepare(`
    INSERT INTO sessions (user_id, session_token, access_jwt, refresh_jwt, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(userId, sessionToken, accessJwt, refreshJwt, expiresAt);
  return getSessionByToken(sessionToken)!;
}

export function getSessionByToken(token: string): Session | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM sessions WHERE session_token = ? AND expires_at > datetime('now')");
  return stmt.get(token) as Session | null;
}

export function deleteSession(token: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM sessions WHERE session_token = ?');
  stmt.run(token);
}

export function deleteExpiredSessions(): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')");
  stmt.run();
}

export function updateSessionTokens(sessionId: number, accessJwt: string, refreshJwt: string): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE sessions SET access_jwt = ?, refresh_jwt = ? WHERE id = ?');
  stmt.run(accessJwt, refreshJwt, sessionId);
}

// Document operations
export interface Document {
  id: number;
  uri: string;
  user_id: number;
  publication_id: number | null;
  rkey: string;
  title: string;
  description: string | null;
  author: string;
  content: string; // JSON serialized pages
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export function upsertDocument(
  uri: string,
  userId: number,
  rkey: string,
  title: string,
  author: string,
  content: string,
  description?: string,
  publishedAt?: string,
  publicationId?: number
): Document {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO documents (uri, user_id, rkey, title, author, content, description, published_at, publication_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uri) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      content = excluded.content,
      published_at = excluded.published_at,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(uri, userId, rkey, title, author, content, description || null, publishedAt || null, publicationId || null);
  return getDocumentByUri(uri)!;
}

export function getDocumentByUri(uri: string): Document | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM documents WHERE uri = ?');
  return stmt.get(uri) as Document | null;
}

export function getDocumentByDidAndRkey(did: string, rkey: string): Document | null {
  const db = getDatabase();
  const uri = `at://${did}/pub.leaflet.document/${rkey}`;
  return getDocumentByUri(uri);
}

export function deleteDocument(uri: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM documents WHERE uri = ?');
  stmt.run(uri);
}

export function getDocumentsByUser(userId: number, limit = 50, offset = 0): Document[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM documents
    WHERE user_id = ?
    ORDER BY COALESCE(published_at, created_at) DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset) as Document[];
}

export function getAllDocuments(limit = 50, offset = 0): (Document & { handle: string; display_name: string | null })[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT d.*, u.handle, u.display_name
    FROM documents d
    JOIN users u ON d.user_id = u.id
    ORDER BY COALESCE(d.published_at, d.created_at) DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as (Document & { handle: string; display_name: string | null })[];
}

export function getDocumentCount(): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM documents');
  return (stmt.get() as { count: number }).count;
}

export function getDocumentUrisByUser(userId: number): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT uri FROM documents WHERE user_id = ?');
  const rows = stmt.all(userId) as { uri: string }[];
  return rows.map(r => r.uri);
}

export function getPublicationUrisByUser(userId: number): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT uri FROM publications WHERE user_id = ?');
  const rows = stmt.all(userId) as { uri: string }[];
  return rows.map(r => r.uri);
}

// Publication operations
export interface Publication {
  id: number;
  uri: string;
  user_id: number;
  rkey: string;
  name: string;
  description: string | null;
  base_path: string | null;
  created_at: string;
}

export function upsertPublication(
  uri: string,
  userId: number,
  rkey: string,
  name: string,
  description?: string,
  basePath?: string
): Publication {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO publications (uri, user_id, rkey, name, description, base_path)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(uri) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      base_path = excluded.base_path
  `);
  stmt.run(uri, userId, rkey, name, description || null, basePath || null);
  return getPublicationByUri(uri)!;
}

export function getPublicationByUri(uri: string): Publication | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM publications WHERE uri = ?');
  return stmt.get(uri) as Publication | null;
}

export function deletePublication(uri: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM publications WHERE uri = ?');
  stmt.run(uri);
}

// Jetstream state operations
export function getJetstreamCursor(): string | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT cursor FROM jetstream_state WHERE id = 1');
  const row = stmt.get() as { cursor: string | null } | undefined;
  return row?.cursor ?? null;
}

export function setJetstreamCursor(cursor: string): void {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE jetstream_state SET cursor = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1');
  stmt.run(cursor);
}

// OAuth state operations
export function getOAuthState(key: string): string | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT value FROM oauth_state WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setOAuthState(key: string, value: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO oauth_state (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, created_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, value);
}

export function deleteOAuthState(key: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM oauth_state WHERE key = ?');
  stmt.run(key);
}

export function cleanupOldOAuthState(maxAgeMinutes: number = 10): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM oauth_state WHERE created_at < datetime('now', '-' || ? || ' minutes')");
  stmt.run(maxAgeMinutes);
}

// OAuth session operations
export function getOAuthSession(key: string): string | undefined {
  const db = getDatabase();
  const stmt = db.prepare('SELECT value FROM oauth_sessions WHERE key = ?');
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setOAuthSession(key: string, value: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO oauth_sessions (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(key, value);
}

export function deleteOAuthSession(key: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM oauth_sessions WHERE key = ?');
  stmt.run(key);
}

export function cleanupOldOAuthSessions(maxAgeDays: number = 30): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM oauth_sessions WHERE updated_at < datetime('now', '-' || ? || ' days')");
  stmt.run(maxAgeDays);
}

// Canvas operations
export interface Canvas {
  id: string;
  user_id: number;
  title: string;
  blocks: string; // JSON serialized LocalCanvasBlock[]
  width: number;
  height: number;
  uri: string | null; // ATProto URI when synced
  rkey: string | null; // ATProto record key when synced
  created_at: string;
  updated_at: string;
}

export function createCanvas(id: string, userId: number, title: string, width = 1200, height = 800): Canvas {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO canvases (id, user_id, title, blocks, width, height)
    VALUES (?, ?, ?, '[]', ?, ?)
  `);
  stmt.run(id, userId, title, width, height);
  return getCanvasById(id)!;
}

export function getCanvasById(id: string): Canvas | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM canvases WHERE id = ?');
  return stmt.get(id) as Canvas | null;
}

export function getCanvasesByUser(userId: number, limit = 50, offset = 0): Canvas[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM canvases
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(userId, limit, offset) as Canvas[];
}

export function updateCanvas(id: string, updates: { title?: string; blocks?: string; width?: number; height?: number }): boolean {
  const db = getDatabase();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.blocks !== undefined) {
    fields.push('blocks = ?');
    values.push(updates.blocks);
  }
  if (updates.width !== undefined) {
    fields.push('width = ?');
    values.push(updates.width);
  }
  if (updates.height !== undefined) {
    fields.push('height = ?');
    values.push(updates.height);
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const stmt = db.prepare(`UPDATE canvases SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);
  return result.changes > 0;
}

export function deleteCanvas(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM canvases WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getCanvasCount(userId: number): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM canvases WHERE user_id = ?');
  return (stmt.get(userId) as { count: number }).count;
}

// Canvas ATProto sync functions
export function updateCanvasUri(id: string, uri: string, rkey: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE canvases SET uri = ?, rkey = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const result = stmt.run(uri, rkey, id);
  return result.changes > 0;
}

export function getCanvasByUri(uri: string): Canvas | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM canvases WHERE uri = ?');
  return stmt.get(uri) as Canvas | null;
}

export function getCanvasByRkey(userId: number, rkey: string): Canvas | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM canvases WHERE user_id = ? AND rkey = ?');
  return stmt.get(userId, rkey) as Canvas | null;
}

export function getCanvasUrisByUser(userId: number): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT uri FROM canvases WHERE user_id = ? AND uri IS NOT NULL');
  const rows = stmt.all(userId) as { uri: string }[];
  return rows.map(r => r.uri);
}

export function upsertCanvasFromATProto(
  id: string,
  userId: number,
  uri: string,
  rkey: string,
  title: string,
  blocks: string,
  width: number,
  height: number
): Canvas {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO canvases (id, user_id, uri, rkey, title, blocks, width, height)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(uri) DO UPDATE SET
      title = excluded.title,
      blocks = excluded.blocks,
      width = excluded.width,
      height = excluded.height,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(id, userId, uri, rkey, title, blocks, width, height);
  return getCanvasByUri(uri)!;
}

export function deleteCanvasByUri(uri: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM canvases WHERE uri = ?');
  const result = stmt.run(uri);
  return result.changes > 0;
}
