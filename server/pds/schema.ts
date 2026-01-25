/**
 * PDS Database Schema
 * Additional tables needed for the custom PDS implementation
 */

import Database from 'better-sqlite3';

export function initializePDSSchema(db: Database.Database): void {
  // Social accounts table - links social logins to users
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      avatar_url TEXT,
      access_token TEXT,
      refresh_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(provider, provider_user_id)
    )
  `);

  // Add auth_type column to users table (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN auth_type TEXT DEFAULT 'atproto'`);
  } catch {
    // Column already exists
  }

  // Add signing_key and rotation_key columns to users table (migration)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN signing_key TEXT`);
  } catch {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN rotation_key TEXT`);
  } catch {
    // Column already exists
  }

  // Repository blocks table - stores DAG-CBOR encoded blocks
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_blocks (
      cid TEXT NOT NULL,
      repo_did TEXT NOT NULL,
      content BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (cid, repo_did)
    )
  `);

  // Repository state table - tracks current commit head
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_state (
      did TEXT PRIMARY KEY NOT NULL,
      head_cid TEXT NOT NULL,
      rev TEXT NOT NULL,
      root_cid TEXT NOT NULL,
      signing_key_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Repository records index - for fast lookups
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_did TEXT NOT NULL,
      collection TEXT NOT NULL,
      rkey TEXT NOT NULL,
      cid TEXT NOT NULL,
      record_json TEXT NOT NULL,
      indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(repo_did, collection, rkey)
    )
  `);

  // Repository blobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_blobs (
      cid TEXT PRIMARY KEY NOT NULL,
      repo_did TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      temp_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Blob references table - tracks which records reference which blobs
  db.exec(`
    CREATE TABLE IF NOT EXISTS repo_blob_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blob_cid TEXT NOT NULL,
      record_did TEXT NOT NULL,
      record_collection TEXT NOT NULL,
      record_rkey TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (blob_cid) REFERENCES repo_blobs(cid) ON DELETE CASCADE
    )
  `);

  // Firehose events table - for event stream
  db.exec(`
    CREATE TABLE IF NOT EXISTS firehose_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_did TEXT NOT NULL,
      event_type TEXT NOT NULL,
      commit_cid TEXT,
      rev TEXT,
      since TEXT,
      ops TEXT,
      blobs TEXT,
      car_slice BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // PDS OAuth tokens table - for ATProto OAuth server
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_oauth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id TEXT UNIQUE NOT NULL,
      user_did TEXT NOT NULL,
      client_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      dpop_jkt TEXT,
      access_token_hash TEXT,
      refresh_token_hash TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // PDS OAuth authorization codes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_oauth_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      user_did TEXT NOT NULL,
      client_id TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      scope TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL,
      dpop_jkt TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Social OAuth state table - for GitHub/Google OAuth flow
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_oauth_state (
      state TEXT PRIMARY KEY NOT NULL,
      provider TEXT NOT NULL,
      redirect_uri TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider, provider_user_id);
    CREATE INDEX IF NOT EXISTS idx_repo_blocks_did ON repo_blocks(repo_did);
    CREATE INDEX IF NOT EXISTS idx_repo_records_collection ON repo_records(repo_did, collection);
    CREATE INDEX IF NOT EXISTS idx_repo_records_cid ON repo_records(cid);
    CREATE INDEX IF NOT EXISTS idx_repo_blobs_did ON repo_blobs(repo_did);
    CREATE INDEX IF NOT EXISTS idx_repo_blobs_temp ON repo_blobs(temp_key);
    CREATE INDEX IF NOT EXISTS idx_repo_blob_refs_blob ON repo_blob_refs(blob_cid);
    CREATE INDEX IF NOT EXISTS idx_repo_blob_refs_record ON repo_blob_refs(record_did, record_collection, record_rkey);
    CREATE INDEX IF NOT EXISTS idx_firehose_created ON firehose_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_firehose_did ON firehose_events(repo_did);
    CREATE INDEX IF NOT EXISTS idx_pds_oauth_tokens_did ON pds_oauth_tokens(user_did);
    CREATE INDEX IF NOT EXISTS idx_pds_oauth_codes_expires ON pds_oauth_codes(expires_at);
    CREATE INDEX IF NOT EXISTS idx_social_oauth_state_created ON social_oauth_state(created_at);
  `);
}
