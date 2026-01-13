import Database from 'better-sqlite3';

export function initializeDatabase(db: Database.Database): void {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT UNIQUE NOT NULL,
      handle TEXT NOT NULL,
      display_name TEXT,
      pds_url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_indexed_at DATETIME
    )
  `);

  // Create publications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uri TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      rkey TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      base_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uri TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      publication_id INTEGER,
      rkey TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE SET NULL
    )
  `);

  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_token TEXT UNIQUE NOT NULL,
      access_jwt TEXT,
      refresh_jwt TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_published_at ON documents(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_users_did ON users(did);
    CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
  `);

  // Create jetstream_state table for cursor persistence
  // This allows the app to resume from where it left off after restarts
  db.exec(`
    CREATE TABLE IF NOT EXISTS jetstream_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      cursor TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure there's always exactly one row in jetstream_state
  db.exec(`
    INSERT OR IGNORE INTO jetstream_state (id, cursor) VALUES (1, NULL)
  `);

  // Create OAuth state table for storing authorization flow state
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create OAuth sessions table for storing OAuth tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_sessions (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for cleanup of old OAuth state
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_oauth_state_created_at ON oauth_state(created_at);
    CREATE INDEX IF NOT EXISTS idx_oauth_sessions_updated_at ON oauth_sessions(updated_at);
  `);

  // Create local canvases table for canvas editor
  db.exec(`
    CREATE TABLE IF NOT EXISTS canvases (
      id TEXT PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      blocks TEXT NOT NULL DEFAULT '[]',
      width INTEGER NOT NULL DEFAULT 1200,
      height INTEGER NOT NULL DEFAULT 800,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index for canvas lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_canvases_user_id ON canvases(user_id);
    CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON canvases(updated_at DESC);
  `);
}
