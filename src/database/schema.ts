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
}
