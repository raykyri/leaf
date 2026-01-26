/**
 * PDS Database Queries
 *
 * Database operations for PDS functionality.
 */

import { getDatabase } from '../../database/index.ts';
import type { EncryptedKeyData } from '../identity/keys.ts';

// Account types
export interface PdsAccount {
  id: number;
  did: string;
  handle: string;
  email: string;
  social_provider: 'github' | 'google';
  social_provider_id: string;
  signing_key: string; // JSON-encoded EncryptedKeyData
  rotation_keys: string; // JSON array of EncryptedKeyData
  recovery_key: string | null;
  created_at: string;
  deactivated_at: string | null;
}

export interface PdsCommit {
  id: number;
  did: string;
  cid: string;
  rev: string;
  prev_cid: string | null;
  root_cid: string;
  data: Buffer;
  created_at: string;
}

export interface PdsRecord {
  id: number;
  did: string;
  collection: string;
  rkey: string;
  cid: string;
  value: Buffer;
  indexed_at: string;
}

export interface PdsBlob {
  id: number;
  did: string;
  cid: string;
  mime_type: string;
  size: number;
  data: Buffer;
  created_at: string;
}

export interface PdsSession {
  id: number;
  did: string;
  access_token_hash: string;
  refresh_token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface PdsRepoState {
  did: string;
  head_cid: string;
  head_rev: string;
  updated_at: string;
}

// Account operations

export function createPdsAccount(
  did: string,
  handle: string,
  email: string,
  socialProvider: 'github' | 'google',
  socialProviderId: string,
  signingKey: EncryptedKeyData,
  rotationKeys: EncryptedKeyData[]
): PdsAccount {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pds_accounts (did, handle, email, social_provider, social_provider_id, signing_key, rotation_keys)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    did,
    handle,
    email,
    socialProvider,
    socialProviderId,
    JSON.stringify(signingKey),
    JSON.stringify(rotationKeys)
  );
  return getPdsAccountByDid(did)!;
}

export function getPdsAccountByDid(did: string): PdsAccount | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_accounts WHERE did = ? AND deactivated_at IS NULL');
  return stmt.get(did) as PdsAccount | null;
}

/**
 * Get account by DID including deactivated accounts (for read-only operations)
 * Use this for public read operations where data should still be accessible.
 */
export function getPdsAccountByDidForRead(did: string): { account: PdsAccount | null; deactivated: boolean } {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_accounts WHERE did = ?');
  const account = stmt.get(did) as PdsAccount | null;
  return {
    account,
    deactivated: account?.deactivated_at !== null,
  };
}

export function getPdsAccountByHandle(handle: string): PdsAccount | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_accounts WHERE handle = ? AND deactivated_at IS NULL');
  return stmt.get(handle) as PdsAccount | null;
}

export function getPdsAccountBySocialId(provider: 'github' | 'google', providerId: string): PdsAccount | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM pds_accounts
    WHERE social_provider = ? AND social_provider_id = ? AND deactivated_at IS NULL
  `);
  return stmt.get(provider, providerId) as PdsAccount | null;
}

export function updatePdsAccountHandle(did: string, newHandle: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE pds_accounts SET handle = ? WHERE did = ?');
  const result = stmt.run(newHandle, did);
  return result.changes > 0;
}

export function deactivatePdsAccount(did: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE pds_accounts SET deactivated_at = CURRENT_TIMESTAMP WHERE did = ?');
  const result = stmt.run(did);
  return result.changes > 0;
}

export function getAllPdsAccountDids(): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT did FROM pds_accounts WHERE deactivated_at IS NULL ORDER BY did ASC');
  const rows = stmt.all() as { did: string }[];
  return rows.map(r => r.did);
}

/**
 * Get paginated list of repos with their state for sync.listRepos
 */
export function listPdsRepos(options?: { limit?: number; cursor?: string }): {
  repos: Array<{ did: string; head: string; rev: string; active: boolean }>;
  cursor?: string;
} {
  const db = getDatabase();
  const limit = options?.limit || 500;
  const cursor = options?.cursor;

  // Join accounts with repo_state to get head info
  let stmt;
  let rows: Array<{ did: string; head_cid: string | null; head_rev: string | null; deactivated_at: string | null }>;

  if (cursor) {
    stmt = db.prepare(`
      SELECT a.did, a.deactivated_at, r.head_cid, r.head_rev
      FROM pds_accounts a
      LEFT JOIN pds_repo_state r ON a.did = r.did
      WHERE a.did > ?
      ORDER BY a.did ASC
      LIMIT ?
    `);
    rows = stmt.all(cursor, limit + 1) as typeof rows;
  } else {
    stmt = db.prepare(`
      SELECT a.did, a.deactivated_at, r.head_cid, r.head_rev
      FROM pds_accounts a
      LEFT JOIN pds_repo_state r ON a.did = r.did
      ORDER BY a.did ASC
      LIMIT ?
    `);
    rows = stmt.all(limit + 1) as typeof rows;
  }

  // Check if there are more results
  let nextCursor: string | undefined;
  if (rows.length > limit) {
    rows.pop();
    nextCursor = rows[rows.length - 1]?.did;
  }

  const repos = rows
    .filter(r => r.head_cid && r.head_rev) // Only include repos with commits
    .map(r => ({
      did: r.did,
      head: r.head_cid!,
      rev: r.head_rev!,
      active: r.deactivated_at === null,
    }));

  return { repos, cursor: nextCursor };
}

// Commit operations

export function createPdsCommit(
  did: string,
  cid: string,
  rev: string,
  rootCid: string,
  data: Buffer,
  prevCid?: string
): PdsCommit {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pds_commits (did, cid, rev, prev_cid, root_cid, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(did, cid, rev, prevCid || null, rootCid, data);
  return getPdsCommitByCid(cid)!;
}

export function getPdsCommitByCid(cid: string): PdsCommit | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_commits WHERE cid = ?');
  return stmt.get(cid) as PdsCommit | null;
}

export function getLatestPdsCommit(did: string): PdsCommit | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM pds_commits
    WHERE did = ?
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return stmt.get(did) as PdsCommit | null;
}

export function getPdsCommitsSince(did: string, sinceRev?: string, limit = 100): PdsCommit[] {
  const db = getDatabase();
  if (sinceRev) {
    const stmt = db.prepare(`
      SELECT * FROM pds_commits
      WHERE did = ? AND rev > ?
      ORDER BY rev ASC
      LIMIT ?
    `);
    return stmt.all(did, sinceRev, limit) as PdsCommit[];
  }
  const stmt = db.prepare(`
    SELECT * FROM pds_commits
    WHERE did = ?
    ORDER BY rev ASC
    LIMIT ?
  `);
  return stmt.all(did, limit) as PdsCommit[];
}

// Record operations

export function upsertPdsRecord(
  did: string,
  collection: string,
  rkey: string,
  cid: string,
  value: Buffer
): PdsRecord {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pds_records (did, collection, rkey, cid, value)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(did, collection, rkey) DO UPDATE SET
      cid = excluded.cid,
      value = excluded.value,
      indexed_at = CURRENT_TIMESTAMP
  `);
  stmt.run(did, collection, rkey, cid, value);
  return getPdsRecord(did, collection, rkey)!;
}

export function getPdsRecord(did: string, collection: string, rkey: string): PdsRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_records WHERE did = ? AND collection = ? AND rkey = ?');
  return stmt.get(did, collection, rkey) as PdsRecord | null;
}

export function deletePdsRecord(did: string, collection: string, rkey: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM pds_records WHERE did = ? AND collection = ? AND rkey = ?');
  const result = stmt.run(did, collection, rkey);
  return result.changes > 0;
}

export function listPdsRecords(
  did: string,
  collection: string,
  options?: { limit?: number; cursor?: string; reverse?: boolean }
): { records: PdsRecord[]; cursor?: string } {
  const db = getDatabase();
  const limit = options?.limit || 50;
  const reverse = options?.reverse ?? false;
  const order = reverse ? 'DESC' : 'ASC';

  let stmt;
  let records: PdsRecord[];

  if (options?.cursor) {
    stmt = db.prepare(`
      SELECT * FROM pds_records
      WHERE did = ? AND collection = ? AND rkey ${reverse ? '<' : '>'} ?
      ORDER BY rkey ${order}
      LIMIT ?
    `);
    records = stmt.all(did, collection, options.cursor, limit + 1) as PdsRecord[];
  } else {
    stmt = db.prepare(`
      SELECT * FROM pds_records
      WHERE did = ? AND collection = ?
      ORDER BY rkey ${order}
      LIMIT ?
    `);
    records = stmt.all(did, collection, limit + 1) as PdsRecord[];
  }

  let cursor: string | undefined;
  if (records.length > limit) {
    records = records.slice(0, limit);
    cursor = records[records.length - 1].rkey;
  }

  return { records, cursor };
}

export function countPdsRecords(did: string, collection?: string): number {
  const db = getDatabase();
  if (collection) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM pds_records WHERE did = ? AND collection = ?');
    return (stmt.get(did, collection) as { count: number }).count;
  }
  const stmt = db.prepare('SELECT COUNT(*) as count FROM pds_records WHERE did = ?');
  return (stmt.get(did) as { count: number }).count;
}

// Blob operations

export function createPdsBlob(
  did: string,
  cid: string,
  mimeType: string,
  data: Buffer
): PdsBlob {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pds_blobs (did, cid, mime_type, size, data)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(did, cid, mimeType, data.length, data);
  return getPdsBlobByCid(cid)!;
}

export function getPdsBlobByCid(cid: string): PdsBlob | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_blobs WHERE cid = ?');
  return stmt.get(cid) as PdsBlob | null;
}

export function listPdsBlobs(did: string, options?: { limit?: number; cursor?: string }): { blobs: PdsBlob[]; cursor?: string } {
  const db = getDatabase();
  const limit = options?.limit || 100;

  let stmt;
  let blobs: PdsBlob[];

  if (options?.cursor) {
    stmt = db.prepare(`
      SELECT * FROM pds_blobs
      WHERE did = ? AND cid > ?
      ORDER BY cid ASC
      LIMIT ?
    `);
    blobs = stmt.all(did, options.cursor, limit + 1) as PdsBlob[];
  } else {
    stmt = db.prepare(`
      SELECT * FROM pds_blobs
      WHERE did = ?
      ORDER BY cid ASC
      LIMIT ?
    `);
    blobs = stmt.all(did, limit + 1) as PdsBlob[];
  }

  let cursor: string | undefined;
  if (blobs.length > limit) {
    blobs = blobs.slice(0, limit);
    cursor = blobs[blobs.length - 1].cid;
  }

  return { blobs, cursor };
}

export function deletePdsBlob(cid: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM pds_blobs WHERE cid = ?');
  const result = stmt.run(cid);
  return result.changes > 0;
}

// Blob reference operations

export function addPdsBlobRef(did: string, blobCid: string, recordUri: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO pds_blob_refs (did, blob_cid, record_uri)
    VALUES (?, ?, ?)
  `);
  stmt.run(did, blobCid, recordUri);
}

export function removePdsBlobRef(blobCid: string, recordUri: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM pds_blob_refs WHERE blob_cid = ? AND record_uri = ?');
  stmt.run(blobCid, recordUri);
}

export function getBlobRefCount(blobCid: string): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM pds_blob_refs WHERE blob_cid = ?');
  return (stmt.get(blobCid) as { count: number }).count;
}

// Session operations

export function createPdsSession(
  did: string,
  accessTokenHash: string,
  refreshTokenHash: string,
  expiresAt: Date
): PdsSession {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pds_sessions (did, access_token_hash, refresh_token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(did, accessTokenHash, refreshTokenHash, expiresAt.toISOString());
  return getPdsSessionByAccessToken(accessTokenHash)!;
}

export function getPdsSessionByAccessToken(accessTokenHash: string): PdsSession | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM pds_sessions WHERE access_token_hash = ? AND expires_at > datetime('now')");
  return stmt.get(accessTokenHash) as PdsSession | null;
}

export function getPdsSessionByRefreshToken(refreshTokenHash: string): PdsSession | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_sessions WHERE refresh_token_hash = ?');
  return stmt.get(refreshTokenHash) as PdsSession | null;
}

export function deletePdsSession(accessTokenHash: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM pds_sessions WHERE access_token_hash = ?');
  stmt.run(accessTokenHash);
}

export function deletePdsSessionsByDid(did: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM pds_sessions WHERE did = ?');
  stmt.run(did);
}

export function deleteExpiredPdsSessions(): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM pds_sessions WHERE expires_at <= datetime('now')");
  stmt.run();
}

// Repo state operations

export function upsertPdsRepoState(did: string, headCid: string, headRev: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pds_repo_state (did, head_cid, head_rev)
    VALUES (?, ?, ?)
    ON CONFLICT(did) DO UPDATE SET
      head_cid = excluded.head_cid,
      head_rev = excluded.head_rev,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(did, headCid, headRev);
}

export function getPdsRepoState(did: string): PdsRepoState | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_repo_state WHERE did = ?');
  return stmt.get(did) as PdsRepoState | null;
}

// Sequencer operations

export function getNextSequence(): number {
  const db = getDatabase();
  const stmt = db.prepare('UPDATE pds_sequencer_counter SET next_seq = next_seq + 1 WHERE id = 1 RETURNING next_seq - 1 as seq');
  const result = stmt.get() as { seq: number };
  return result.seq;
}

export function createPdsSequencerEvent(
  did: string,
  eventType: string,
  eventData: Buffer,
  commitCid?: string
): number {
  const db = getDatabase();
  const seq = getNextSequence();
  const stmt = db.prepare(`
    INSERT INTO pds_sequencer (seq, did, commit_cid, event_type, event_data)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(seq, did, commitCid || null, eventType, eventData);
  return seq;
}

export function getPdsSequencerEventsSince(sinceSeq: number, limit = 100): Array<{
  seq: number;
  did: string;
  commit_cid: string | null;
  event_type: string;
  event_data: Buffer;
  created_at: string;
}> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM pds_sequencer
    WHERE seq > ?
    ORDER BY seq ASC
    LIMIT ?
  `);
  return stmt.all(sinceSeq, limit) as Array<{
    seq: number;
    did: string;
    commit_cid: string | null;
    event_type: string;
    event_data: Buffer;
    created_at: string;
  }>;
}

export function getLatestSequence(): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT MAX(seq) as max_seq FROM pds_sequencer');
  const result = stmt.get() as { max_seq: number | null };
  return result.max_seq || 0;
}

// OAuth state operations

export interface PdsOAuthState {
  state: string;
  provider: string;
  data: string;
  created_at: string;
}

export function savePdsOAuthState(state: string, provider: string, data: object): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO pds_oauth_state (state, provider, data)
    VALUES (?, ?, ?)
  `);
  stmt.run(state, provider, JSON.stringify(data));
}

export function getPdsOAuthState(state: string): { provider: string; data: object } | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM pds_oauth_state WHERE state = ?');
  const row = stmt.get(state) as PdsOAuthState | null;
  if (!row) {
    return null;
  }
  return {
    provider: row.provider,
    data: JSON.parse(row.data),
  };
}

export function deletePdsOAuthState(state: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM pds_oauth_state WHERE state = ?');
  stmt.run(state);
}

export function cleanupExpiredPdsOAuthState(maxAgeMinutes = 10): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM pds_oauth_state WHERE created_at < datetime('now', '-' || ? || ' minutes')");
  stmt.run(maxAgeMinutes);
}
