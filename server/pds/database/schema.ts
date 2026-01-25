/**
 * PDS Database Schema Extensions
 *
 * Additional tables for the Personal Data Server functionality.
 */

import Database from 'better-sqlite3';

export function initializePdsSchema(db: Database.Database): void {
  // PDS Accounts - users who signed up via social login
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT UNIQUE NOT NULL,
      handle TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      social_provider TEXT NOT NULL,
      social_provider_id TEXT NOT NULL,
      signing_key TEXT NOT NULL,
      rotation_keys TEXT NOT NULL,
      recovery_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deactivated_at DATETIME,
      UNIQUE(social_provider, social_provider_id)
    )
  `);

  // Create indices for pds_accounts
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pds_accounts_did ON pds_accounts(did);
    CREATE INDEX IF NOT EXISTS idx_pds_accounts_handle ON pds_accounts(handle);
    CREATE INDEX IF NOT EXISTS idx_pds_accounts_email ON pds_accounts(email);
    CREATE INDEX IF NOT EXISTS idx_pds_accounts_social ON pds_accounts(social_provider, social_provider_id);
  `);

  // PDS Commits - repository commit history
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT NOT NULL,
      cid TEXT UNIQUE NOT NULL,
      rev TEXT NOT NULL,
      prev_cid TEXT,
      root_cid TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pds_commits_did ON pds_commits(did);
    CREATE INDEX IF NOT EXISTS idx_pds_commits_rev ON pds_commits(did, rev);
  `);

  // PDS Records - individual records in repositories
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT NOT NULL,
      collection TEXT NOT NULL,
      rkey TEXT NOT NULL,
      cid TEXT NOT NULL,
      value BLOB NOT NULL,
      indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(did, collection, rkey),
      FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pds_records_did ON pds_records(did);
    CREATE INDEX IF NOT EXISTS idx_pds_records_collection ON pds_records(did, collection);
  `);

  // PDS Blobs - binary data storage
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_blobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT NOT NULL,
      cid TEXT UNIQUE NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pds_blobs_did ON pds_blobs(did);
    CREATE INDEX IF NOT EXISTS idx_pds_blobs_cid ON pds_blobs(cid);
  `);

  // PDS Blob References - tracks which records reference which blobs
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_blob_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT NOT NULL,
      blob_cid TEXT NOT NULL,
      record_uri TEXT NOT NULL,
      UNIQUE(blob_cid, record_uri),
      FOREIGN KEY (blob_cid) REFERENCES pds_blobs(cid) ON DELETE CASCADE
    )
  `);

  // PDS Sessions - JWT-based authentication sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      did TEXT NOT NULL,
      access_token_hash TEXT UNIQUE NOT NULL,
      refresh_token_hash TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pds_sessions_did ON pds_sessions(did);
    CREATE INDEX IF NOT EXISTS idx_pds_sessions_access ON pds_sessions(access_token_hash);
    CREATE INDEX IF NOT EXISTS idx_pds_sessions_refresh ON pds_sessions(refresh_token_hash);
    CREATE INDEX IF NOT EXISTS idx_pds_sessions_expires ON pds_sessions(expires_at);
  `);

  // PDS Sequencer - event stream for firehose
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_sequencer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seq INTEGER UNIQUE NOT NULL,
      did TEXT NOT NULL,
      commit_cid TEXT,
      event_type TEXT NOT NULL,
      event_data BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pds_sequencer_seq ON pds_sequencer(seq);
    CREATE INDEX IF NOT EXISTS idx_pds_sequencer_did ON pds_sequencer(did);
  `);

  // PDS Repo State - current state of each repository
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_repo_state (
      did TEXT PRIMARY KEY NOT NULL,
      head_cid TEXT NOT NULL,
      head_rev TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
    )
  `);

  // Sequencer counter for generating monotonic sequence numbers
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_sequencer_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_seq INTEGER NOT NULL DEFAULT 1
    )
  `);

  // Initialize sequencer counter
  db.exec(`
    INSERT OR IGNORE INTO pds_sequencer_counter (id, next_seq) VALUES (1, 1)
  `);
}
