# Leaf PDS Implementation Plan

## Executive Summary

This document outlines a plan for implementing a Personal Data Server (PDS) within Leaf to support users who authenticate via GitHub or Google OAuth. These users don't have existing ATProto identities (like Bluesky accounts), so Leaf needs to host their data locally while maintaining full compatibility with the ATProto federation protocol.

## Background

### Current Architecture

Leaf currently operates as an **ATProto client application** that:
1. Authenticates users via ATProto OAuth (Bluesky accounts) or app passwords
2. Reads/writes data to users' existing PDSes (e.g., bsky.social)
3. Indexes Leaflet documents from remote PDSes into a local SQLite cache
4. Subscribes to Jetstream for real-time updates

### The Problem

Users who authenticate via GitHub or Google don't have ATProto accounts. They need:
1. A DID (Decentralized Identifier) for their ATProto identity
2. A PDS to host their repository data
3. The ability to create/edit Leaflet documents
4. Federation compatibility so their content is visible to the ATProto network

## ATProto PDS Overview

### What is a PDS?

A Personal Data Server is the fundamental building block of ATProto that:
- Hosts user **repositories** (signed Merkle trees of records)
- Provides **XRPC endpoints** for reading/writing data
- Manages **user accounts** and authentication
- Publishes a **firehose** of repository events for federation
- Resolves **handles** to DIDs

### Reference Implementation Analysis

The Bluesky reference PDS (`@atproto/pds`) is a mature, production-tested implementation with:

**Core Components:**
- `AccountManager` - User account management, sessions, invites
- `ActorStore` - Per-user SQLite databases for repository data
- `BlobStore` - File storage (disk or S3)
- `Sequencer` - Event firehose for federation
- `Crawlers` - Notification of relay services
- OAuth Provider integration

**Key Dependencies:**
```
@atproto/repo       - Merkle Search Tree (MST) and repository operations
@atproto/crypto     - Cryptographic primitives (secp256k1, P-256)
@atproto/identity   - DID resolution and handle verification
@atproto/xrpc-server - XRPC endpoint framework
@atproto/oauth-provider - OAuth 2.0 provider implementation
@did-plc/lib        - DID:PLC creation and management
```

### Key Architectural Decisions

After analyzing the reference implementation and considering Leaf's requirements, I recommend:

**Option A: Embed @atproto/pds as a library** ❌
- Pros: Full compatibility, battle-tested
- Cons: Heavy (uses Express, Redis optional, complex config), designed for standalone deployment

**Option B: Reimplement PDS from scratch using ATProto libraries** ✅ (Recommended)
- Pros: Tailored to Leaf's needs, integrates with existing Hono server, lighter weight
- Cons: More initial development work, must track spec changes

**Rationale:** The reference PDS is designed as a standalone service with features Leaf doesn't need (multi-tenant hosting, invite systems, entryway federation). A purpose-built implementation using the core ATProto libraries will be more maintainable and better integrated.

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Database Schema Extensions

Add new tables for PDS functionality:

```sql
-- PDS accounts for local users (GitHub/Google OAuth)
CREATE TABLE pds_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT UNIQUE NOT NULL,           -- did:plc:xxx
  handle TEXT UNIQUE NOT NULL,        -- username.leaf.example.com
  email TEXT UNIQUE,
  oauth_provider TEXT NOT NULL,       -- 'github' | 'google'
  oauth_id TEXT NOT NULL,             -- Provider's user ID
  signing_key BLOB NOT NULL,          -- Private key (encrypted)
  rotation_key BLOB NOT NULL,         -- Recovery key (encrypted)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deactivated_at DATETIME,
  UNIQUE(oauth_provider, oauth_id)
);

-- Repository state per user
CREATE TABLE pds_repos (
  did TEXT PRIMARY KEY,
  root_cid TEXT NOT NULL,             -- Current repo root CID
  rev TEXT NOT NULL,                  -- Current revision (TID)
  commit_cid TEXT NOT NULL,           -- Latest signed commit CID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MST nodes for repository tree structure
CREATE TABLE pds_mst_nodes (
  did TEXT NOT NULL,
  cid TEXT NOT NULL,
  data BLOB NOT NULL,                 -- CBOR-encoded node
  PRIMARY KEY (did, cid)
);

-- Records stored in repositories
CREATE TABLE pds_records (
  did TEXT NOT NULL,
  collection TEXT NOT NULL,           -- e.g., 'pub.leaflet.document'
  rkey TEXT NOT NULL,                 -- Record key (TID)
  cid TEXT NOT NULL,                  -- Record CID
  value BLOB NOT NULL,                -- CBOR-encoded record
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (did, collection, rkey)
);

-- Blobs (images, files) stored for users
CREATE TABLE pds_blobs (
  did TEXT NOT NULL,
  cid TEXT NOT NULL,                  -- Blob CID
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (did, cid)
);

-- Blob file storage location
-- Actual files stored at: data/blobs/{did_hash}/{cid}

-- Sequencer for firehose events
CREATE TABLE pds_sequencer (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  event_type TEXT NOT NULL,           -- 'commit' | 'handle' | 'identity'
  event BLOB NOT NULL,                -- CBOR-encoded event
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Session tokens for PDS authentication
CREATE TABLE pds_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  access_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.2 Cryptographic Key Management

```typescript
// server/pds/crypto/keys.ts
import { Secp256k1Keypair } from '@atproto/crypto';
import crypto from 'crypto';

export interface KeyPair {
  signing: Secp256k1Keypair;
  rotation: Secp256k1Keypair;
}

export async function generateKeypair(): Promise<Secp256k1Keypair> {
  return Secp256k1Keypair.create({ exportable: true });
}

export async function encryptKey(
  privateKey: Uint8Array, 
  masterSecret: string
): Promise<Buffer> {
  const key = crypto.scryptSync(masterSecret, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export async function decryptKey(
  encrypted: Buffer,
  masterSecret: string
): Promise<Uint8Array> {
  const key = crypto.scryptSync(masterSecret, 'salt', 32);
  const iv = encrypted.subarray(0, 16);
  const tag = encrypted.subarray(16, 32);
  const data = encrypted.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([
    decipher.update(data),
    decipher.final()
  ]));
}
```

#### 1.3 DID:PLC Integration

```typescript
// server/pds/identity/did.ts
import * as plc from '@did-plc/lib';
import { Secp256k1Keypair } from '@atproto/crypto';

const PLC_DIRECTORY = 'https://plc.directory';

export interface CreateDidOptions {
  handle: string;
  signingKey: Secp256k1Keypair;
  rotationKey: Secp256k1Keypair;
  pdsEndpoint: string;
}

export async function createDid(opts: CreateDidOptions): Promise<string> {
  const client = new plc.Client(PLC_DIRECTORY);
  
  const did = await client.createDid({
    signingKey: opts.signingKey.did(),
    handle: opts.handle,
    pds: opts.pdsEndpoint,
    rotationKeys: [opts.rotationKey.did()],
    signer: opts.rotationKey,
  });
  
  return did;
}

export async function updateHandle(
  did: string,
  newHandle: string,
  rotationKey: Secp256k1Keypair
): Promise<void> {
  const client = new plc.Client(PLC_DIRECTORY);
  
  // Get current document
  const doc = await client.getDocumentData(did);
  
  // Create update operation
  await client.updateAtprotoKey(
    did,
    rotationKey,
    doc.signingKey,
    doc.rotationKeys,
    { handle: newHandle }
  );
}
```

### Phase 2: Repository Management

#### 2.1 Merkle Search Tree Implementation

The MST is the core data structure for ATProto repositories. We'll use `@atproto/repo` for this:

```typescript
// server/pds/repo/repository.ts
import { Repo, WriteOpAction, CommitData } from '@atproto/repo';
import { BlobStore } from '@atproto/repo';
import { Keypair } from '@atproto/crypto';
import { CID } from 'multiformats/cid';

export class UserRepository {
  constructor(
    private did: string,
    private storage: RepoStorage,
    private blobstore: BlobStore,
    private keypair: Keypair
  ) {}

  async createRecord(
    collection: string,
    rkey: string,
    record: unknown
  ): Promise<{ uri: string; cid: CID; commit: CommitData }> {
    const repo = await this.loadRepo();
    
    const writeOp = {
      action: WriteOpAction.Create,
      collection,
      rkey,
      record,
    };
    
    const commit = await repo.applyWrites([writeOp], this.keypair);
    await this.saveCommit(commit);
    
    return {
      uri: `at://${this.did}/${collection}/${rkey}`,
      cid: commit.newCids[0],
      commit,
    };
  }

  async updateRecord(
    collection: string,
    rkey: string,
    record: unknown,
    swapCommit?: CID
  ): Promise<{ uri: string; cid: CID; commit: CommitData }> {
    const repo = await this.loadRepo();
    
    const writeOp = {
      action: WriteOpAction.Update,
      collection,
      rkey,
      record,
      swapCid: swapCommit,
    };
    
    const commit = await repo.applyWrites([writeOp], this.keypair);
    await this.saveCommit(commit);
    
    return {
      uri: `at://${this.did}/${collection}/${rkey}`,
      cid: commit.newCids[0],
      commit,
    };
  }

  async deleteRecord(
    collection: string,
    rkey: string,
    swapCommit?: CID
  ): Promise<{ commit: CommitData }> {
    const repo = await this.loadRepo();
    
    const writeOp = {
      action: WriteOpAction.Delete,
      collection,
      rkey,
      swapCid: swapCommit,
    };
    
    const commit = await repo.applyWrites([writeOp], this.keypair);
    await this.saveCommit(commit);
    
    return { commit };
  }

  async getRecord(collection: string, rkey: string): Promise<unknown | null> {
    const repo = await this.loadRepo();
    return repo.getRecord(collection, rkey);
  }

  async listRecords(
    collection: string,
    opts?: { limit?: number; cursor?: string; reverse?: boolean }
  ): Promise<{ records: Array<{ uri: string; cid: CID; value: unknown }>; cursor?: string }> {
    const repo = await this.loadRepo();
    return repo.listRecords(collection, opts);
  }

  private async loadRepo(): Promise<Repo> {
    // Load from storage or create new
  }

  private async saveCommit(commit: CommitData): Promise<void> {
    // Persist to database
  }
}
```

#### 2.2 Blob Storage

```typescript
// server/pds/repo/blobstore.ts
import { BlobStore, BlobRef } from '@atproto/repo';
import { CID } from 'multiformats/cid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from '@atproto/crypto';

export class DiskBlobStore implements BlobStore {
  constructor(
    private basePath: string,
    private did: string
  ) {}

  private getBlobPath(cid: CID): string {
    const didHash = crypto.sha256Hex(this.did).slice(0, 8);
    return path.join(this.basePath, didHash, cid.toString());
  }

  async putTemp(data: Uint8Array): Promise<string> {
    const tempId = crypto.randomStr(16, 'base32');
    const tempPath = path.join(this.basePath, 'temp', tempId);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, data);
    return tempId;
  }

  async makePermanent(tempId: string, cid: CID): Promise<void> {
    const tempPath = path.join(this.basePath, 'temp', tempId);
    const finalPath = this.getBlobPath(cid);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.rename(tempPath, finalPath);
  }

  async getBytes(cid: CID): Promise<Uint8Array> {
    const blobPath = this.getBlobPath(cid);
    return new Uint8Array(await fs.readFile(blobPath));
  }

  async hasStored(cid: CID): Promise<boolean> {
    try {
      await fs.access(this.getBlobPath(cid));
      return true;
    } catch {
      return false;
    }
  }

  async delete(cid: CID): Promise<void> {
    await fs.unlink(this.getBlobPath(cid));
  }
}
```

### Phase 3: XRPC Endpoints

#### 3.1 Required ATProto XRPC Endpoints

The PDS must implement these XRPC endpoints:

**Server Endpoints (`com.atproto.server.*`):**
- `describeServer` - Server capabilities and configuration
- `createSession` - Login with identifier/password (for app passwords)
- `refreshSession` - Refresh access tokens
- `deleteSession` - Logout
- `getSession` - Get current session info

**Repository Endpoints (`com.atproto.repo.*`):**
- `createRecord` - Create a new record
- `putRecord` - Create or update a record
- `deleteRecord` - Delete a record
- `getRecord` - Get a single record
- `listRecords` - List records in a collection
- `describeRepo` - Get repository metadata
- `uploadBlob` - Upload a blob (image/file)

**Sync Endpoints (`com.atproto.sync.*`):**
- `getRepo` - Export full repository (CAR format)
- `getBlob` - Get a stored blob
- `getLatestCommit` - Get latest commit info
- `subscribeRepos` - WebSocket firehose for federation

**Identity Endpoints (`com.atproto.identity.*`):**
- `resolveHandle` - Resolve handle to DID

#### 3.2 XRPC Route Implementation

```typescript
// server/pds/routes/xrpc.ts
import { Hono } from 'hono';
import { z } from 'zod';

const pdsXrpc = new Hono();

// com.atproto.server.describeServer
pdsXrpc.get('/xrpc/com.atproto.server.describeServer', async (c) => {
  const publicUrl = process.env.PUBLIC_URL!;
  const hostname = new URL(publicUrl).hostname;
  
  return c.json({
    did: `did:web:${hostname}`,
    availableUserDomains: [`.${hostname}`],
    inviteCodeRequired: false,
    phoneVerificationRequired: false,
    links: {
      privacyPolicy: `${publicUrl}/privacy`,
      termsOfService: `${publicUrl}/terms`,
    },
    contact: {
      email: process.env.CONTACT_EMAIL,
    },
  });
});

// com.atproto.repo.createRecord
pdsXrpc.post('/xrpc/com.atproto.repo.createRecord', async (c) => {
  const auth = await verifyAuth(c);
  
  const body = await c.req.json();
  const { repo, collection, rkey, record, validate, swapCommit } = body;
  
  // Verify the authenticated user matches the repo
  if (repo !== auth.did) {
    return c.json({ error: 'Unauthorized', message: 'Cannot write to another user\'s repo' }, 403);
  }
  
  // Validate record against lexicon if requested
  if (validate !== false) {
    await validateRecord(collection, record);
  }
  
  const result = await userRepo.createRecord(collection, rkey, record);
  
  // Emit to sequencer for federation
  await sequencer.emit({
    type: 'commit',
    did: auth.did,
    commit: result.commit,
  });
  
  return c.json({
    uri: result.uri,
    cid: result.cid.toString(),
  });
});

// com.atproto.sync.subscribeRepos (WebSocket)
pdsXrpc.get('/xrpc/com.atproto.sync.subscribeRepos', async (c) => {
  // Upgrade to WebSocket
  const { socket, response } = Deno.upgradeWebSocket(c.req);
  
  const cursor = c.req.query('cursor');
  
  // Subscribe to sequencer events
  const subscription = sequencer.subscribe(cursor);
  
  for await (const event of subscription) {
    socket.send(event);
  }
  
  return response;
});

export default pdsXrpc;
```

### Phase 4: OAuth Integration (GitHub/Google)

#### 4.1 Third-Party OAuth Flow

```typescript
// server/pds/auth/oauth-providers.ts
import { Hono } from 'hono';

const oauthProviders = new Hono();

// GitHub OAuth
oauthProviders.get('/auth/github', async (c) => {
  const state = crypto.randomUUID();
  await saveOAuthState(state, 'github');
  
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set('redirect_uri', `${process.env.PUBLIC_URL}/auth/github/callback`);
  url.searchParams.set('scope', 'user:email');
  url.searchParams.set('state', state);
  
  return c.redirect(url.toString());
});

oauthProviders.get('/auth/github/callback', async (c) => {
  const { code, state } = c.req.query();
  
  // Verify state
  const savedState = await getOAuthState(state);
  if (!savedState || savedState.provider !== 'github') {
    return c.json({ error: 'Invalid state' }, 400);
  }
  
  // Exchange code for token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  
  const { access_token } = await tokenResponse.json();
  
  // Get user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const githubUser = await userResponse.json();
  
  // Check if user exists
  let pdsAccount = await getPdsAccountByOAuth('github', githubUser.id);
  
  if (!pdsAccount) {
    // Create new PDS account
    pdsAccount = await createPdsAccount({
      provider: 'github',
      providerId: githubUser.id,
      email: githubUser.email,
      suggestedHandle: githubUser.login,
    });
  }
  
  // Create session
  const session = await createPdsSession(pdsAccount.did);
  
  return c.redirect(`${process.env.PUBLIC_URL}/profile`);
});

// Google OAuth (similar pattern)
oauthProviders.get('/auth/google', async (c) => {
  // ... Google OAuth implementation
});

export default oauthProviders;
```

#### 4.2 Account Creation Flow

```typescript
// server/pds/account/create.ts
import { generateKeypair, encryptKey } from '../crypto/keys';
import { createDid } from '../identity/did';

export interface CreatePdsAccountOptions {
  provider: 'github' | 'google';
  providerId: string;
  email?: string;
  suggestedHandle: string;
}

export async function createPdsAccount(opts: CreatePdsAccountOptions): Promise<PdsAccount> {
  const publicUrl = process.env.PUBLIC_URL!;
  const hostname = new URL(publicUrl).hostname;
  
  // Generate cryptographic keys
  const signingKey = await generateKeypair();
  const rotationKey = await generateKeypair();
  
  // Normalize handle
  const handle = normalizeHandle(opts.suggestedHandle, hostname);
  
  // Create DID:PLC
  const did = await createDid({
    handle,
    signingKey,
    rotationKey,
    pdsEndpoint: publicUrl,
  });
  
  // Encrypt keys for storage
  const masterSecret = process.env.KEY_ENCRYPTION_SECRET!;
  const encryptedSigningKey = await encryptKey(await signingKey.export(), masterSecret);
  const encryptedRotationKey = await encryptKey(await rotationKey.export(), masterSecret);
  
  // Initialize empty repository
  await initializeRepository(did, signingKey);
  
  // Store account
  const account = await db.insertPdsAccount({
    did,
    handle,
    email: opts.email,
    oauth_provider: opts.provider,
    oauth_id: opts.providerId,
    signing_key: encryptedSigningKey,
    rotation_key: encryptedRotationKey,
  });
  
  return account;
}

function normalizeHandle(suggested: string, hostname: string): string {
  // Remove invalid characters, ensure uniqueness
  const base = suggested.toLowerCase().replace(/[^a-z0-9-]/g, '');
  
  // Check availability and append numbers if needed
  let handle = `${base}.${hostname}`;
  let suffix = 1;
  
  while (await handleExists(handle)) {
    handle = `${base}${suffix}.${hostname}`;
    suffix++;
  }
  
  return handle;
}
```

### Phase 5: Federation

#### 5.1 Sequencer and Event Firehose

```typescript
// server/pds/federation/sequencer.ts
import { encode as cborEncode } from '@atproto/lex-cbor';

export interface SequencerEvent {
  seq: number;
  did: string;
  type: 'commit' | 'handle' | 'tombstone';
  commit?: {
    rev: string;
    ops: Array<{
      action: 'create' | 'update' | 'delete';
      path: string;
      cid?: string;
    }>;
    blobs: string[];
  };
}

export class Sequencer {
  private subscribers = new Set<(event: Uint8Array) => void>();
  
  async emit(event: Omit<SequencerEvent, 'seq'>): Promise<void> {
    // Persist to database with auto-incrementing seq
    const seq = await this.persistEvent(event);
    
    // Encode as CBOR
    const encoded = cborEncode({ ...event, seq });
    
    // Notify subscribers
    for (const subscriber of this.subscribers) {
      subscriber(encoded);
    }
    
    // Notify relay crawlers
    await this.notifyCrawlers();
  }
  
  subscribe(cursor?: string): AsyncIterable<Uint8Array> {
    // Return async iterator for WebSocket subscription
    return {
      [Symbol.asyncIterator]: () => this.createSubscription(cursor),
    };
  }
  
  private async *createSubscription(cursor?: string) {
    // First, replay from cursor if provided
    if (cursor) {
      const events = await this.getEventsAfterCursor(cursor);
      for (const event of events) {
        yield cborEncode(event);
      }
    }
    
    // Then subscribe to live events
    const queue: Uint8Array[] = [];
    let resolve: () => void;
    
    const handler = (event: Uint8Array) => {
      queue.push(event);
      resolve?.();
    };
    
    this.subscribers.add(handler);
    
    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          await new Promise<void>(r => resolve = r);
        }
      }
    } finally {
      this.subscribers.delete(handler);
    }
  }
  
  private async notifyCrawlers(): Promise<void> {
    // Notify configured relay services
    const relays = process.env.RELAY_HOSTS?.split(',') || [];
    
    for (const relay of relays) {
      fetch(`${relay}/xrpc/com.atproto.sync.requestCrawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: new URL(process.env.PUBLIC_URL!).hostname }),
      }).catch(() => {
        // Ignore crawler notification failures
      });
    }
  }
}
```

#### 5.2 Handle Resolution

```typescript
// server/pds/identity/handle.ts
import { Hono } from 'hono';

const handleRoutes = new Hono();

// /.well-known/atproto-did
handleRoutes.get('/.well-known/atproto-did', async (c) => {
  const host = c.req.header('Host');
  
  // Check if this is a subdomain handle
  const account = await getAccountByHandle(host);
  
  if (account) {
    return c.text(account.did);
  }
  
  return c.text('Not Found', 404);
});

// com.atproto.identity.resolveHandle
handleRoutes.get('/xrpc/com.atproto.identity.resolveHandle', async (c) => {
  const handle = c.req.query('handle');
  
  const account = await getAccountByHandle(handle);
  
  if (!account) {
    return c.json({ error: 'UnknownHandle', message: 'Handle not found' }, 404);
  }
  
  return c.json({ did: account.did });
});

export default handleRoutes;
```

### Phase 6: Integration with Existing Leaf

#### 6.1 Unified Authentication

```typescript
// server/services/unified-auth.ts
export type AuthMethod = 'atproto-oauth' | 'atproto-password' | 'github' | 'google';

export interface UnifiedUser {
  did: string;
  handle: string;
  displayName?: string;
  pdsUrl: string;
  authMethod: AuthMethod;
  isLocalPds: boolean;
}

export async function getAuthenticatedAgent(
  session: Session,
  user: UnifiedUser
): Promise<AtpAgent> {
  if (user.isLocalPds) {
    // Create agent pointing to our local PDS
    const agent = new AtpAgent({ service: process.env.PUBLIC_URL });
    
    // Use session tokens from local PDS
    await agent.resumeSession({
      did: user.did,
      handle: user.handle,
      accessJwt: session.access_jwt,
      refreshJwt: session.refresh_jwt,
      active: true,
    });
    
    return agent;
  }
  
  // Use existing remote PDS logic
  return getRemoteAuthenticatedAgent(session, user);
}
```

#### 6.2 Updated Database Schema

```typescript
// Extend existing users table to track auth method
// Add migration:

db.exec(`
  ALTER TABLE users ADD COLUMN auth_method TEXT DEFAULT 'atproto-oauth';
  ALTER TABLE users ADD COLUMN is_local_pds BOOLEAN DEFAULT 0;
`);
```

### Phase 7: Configuration

#### 7.1 Environment Variables

```env
# Existing
PORT=3334
DATABASE_PATH=./data/app.db
SESSION_SECRET=<random-secret>
PUBLIC_URL=https://leaf.example.com
JETSTREAM_URL=wss://jetstream2.us-east.bsky.network/subscribe

# New PDS Configuration
PDS_ENABLED=true
PDS_DATA_DIR=./data/pds
PDS_BLOB_DIR=./data/blobs

# Key encryption (for storing user private keys)
KEY_ENCRYPTION_SECRET=<random-secret-at-least-32-chars>

# DID:PLC directory
PLC_DIRECTORY_URL=https://plc.directory

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Federation
RELAY_HOSTS=https://bsky.network

# Handle domains (users get handles like username.leaf.example.com)
HANDLE_DOMAIN=leaf.example.com
```

### Phase 8: Deployment Considerations

#### 8.1 Single-Server Architecture

For a single VPS deployment:

```
┌─────────────────────────────────────────────────────────┐
│                    Leaf Server (VPS)                     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                 Hono HTTP Server                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │ │
│  │  │   React     │  │   Auth      │  │   PDS      │ │ │
│  │  │   Frontend  │  │   Routes    │  │   XRPC     │ │ │
│  │  └─────────────┘  └─────────────┘  └────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                     Storage                         │ │
│  │  ┌────────────┐  ┌─────────────┐  ┌────────────┐  │ │
│  │  │  SQLite    │  │  Blob       │  │  User      │  │ │
│  │  │  Database  │  │  Storage    │  │  Repos     │  │ │
│  │  └────────────┘  └─────────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                   Background                        │ │
│  │  ┌────────────┐  ┌─────────────┐                   │ │
│  │  │ Jetstream  │  │ Sequencer   │                   │ │
│  │  │ Listener   │  │ (Firehose)  │                   │ │
│  │  └────────────┘  └─────────────┘                   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### 8.2 DNS Configuration

```
; A records
leaf.example.com.        A     <server-ip>
*.leaf.example.com.      A     <server-ip>

; The wildcard allows user handles like alice.leaf.example.com
```

#### 8.3 Scaling Considerations

For Substack-level scale (~2M monthly users):

1. **Database**: SQLite with WAL mode can handle significant read load. Consider PostgreSQL migration path for horizontal scaling.

2. **Blob Storage**: Start with disk, migrate to S3/GCS for large scale.

3. **Sequencer**: In-memory with SQLite backing is sufficient for moderate load. Redis can be added for pub/sub at scale.

4. **Compute**: Single large VPS (16+ cores, 64GB RAM) can handle substantial load due to SQLite's efficiency.

## Implementation Timeline

### Milestone 1: Core PDS (Weeks 1-3)
- [ ] Database schema extensions
- [ ] Cryptographic key management
- [ ] DID:PLC integration
- [ ] Basic repository operations

### Milestone 2: XRPC Endpoints (Weeks 4-6)
- [ ] Server endpoints (describeServer, sessions)
- [ ] Repository endpoints (CRUD operations)
- [ ] Sync endpoints (getRepo, getBlob)
- [ ] Blob upload/storage

### Milestone 3: OAuth & Accounts (Weeks 7-8)
- [ ] GitHub OAuth integration
- [ ] Google OAuth integration
- [ ] Account creation flow
- [ ] Handle assignment

### Milestone 4: Federation (Weeks 9-10)
- [ ] Sequencer implementation
- [ ] WebSocket firehose (subscribeRepos)
- [ ] Relay notification
- [ ] Handle resolution

### Milestone 5: Integration (Weeks 11-12)
- [ ] Unified authentication layer
- [ ] UI updates for provider selection
- [ ] Testing with existing Bluesky users
- [ ] Documentation

## Dependencies to Add

```json
{
  "dependencies": {
    "@atproto/repo": "^0.4.x",
    "@atproto/crypto": "^0.4.x",
    "@atproto/identity": "^0.4.x",
    "@atproto/xrpc-server": "^0.5.x",
    "@atproto/lexicon": "^0.4.x",
    "@atproto/common": "^0.4.x",
    "@atproto/syntax": "^0.3.x",
    "@did-plc/lib": "^0.0.4",
    "multiformats": "^9.9.0"
  }
}
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ATProto spec changes | High | Pin dependency versions, monitor spec updates |
| DID:PLC rate limits | Medium | Implement retry logic, consider running own PLC node |
| Scaling limitations | Medium | Design for PostgreSQL migration path |
| Key compromise | Critical | HSM integration for production, secure key derivation |
| Handle squatting | Low | Require email verification, implement reservation |

## Testing Strategy

1. **Unit Tests**: Repository operations, cryptographic functions
2. **Integration Tests**: Full XRPC endpoint testing
3. **Federation Tests**: Verify interoperability with Bluesky network
4. **Load Tests**: Simulate Substack-level traffic patterns

## Open Questions

1. **Handle Policy**: How to handle username conflicts between GitHub/Google users?
2. **Migration Path**: Should users be able to migrate to their own PDS later?
3. **Moderation**: How to handle content moderation for locally-hosted content?
4. **Backup/Recovery**: What's the backup strategy for user repositories?

## Conclusion

Implementing a PDS within Leaf is a significant but achievable undertaking. By leveraging the official ATProto TypeScript libraries and following the reference implementation patterns, we can build a robust PDS that:

1. Provides full ATProto compatibility for GitHub/Google users
2. Integrates seamlessly with the existing Leaf architecture
3. Federates properly with the broader ATProto network
4. Scales to Substack-level usage on a single VPS

The phased approach allows for incremental development and testing, with clear milestones for tracking progress.
