# Custom PDS Implementation Plan for Leaf

## Executive Summary

This document outlines a comprehensive plan to implement a custom Personal Data Server (PDS) within Leaf, enabling users who authenticate via GitHub or Google (social login) to participate in the AT Protocol network. Currently, Leaf only supports users with existing ATProto identities (Bluesky accounts). This implementation will allow Leaf to create and manage ATProto identities for social login users.

## Problem Statement

**Current State:**
- Leaf users must have an existing Bluesky/ATProto account to use the platform
- Authentication is either via ATProto OAuth or app passwords against external PDSes
- Users' data is stored on their chosen PDS (typically bsky.social)

**Desired State:**
- Users can sign in with GitHub or Google accounts
- Leaf creates and manages ATProto identities (DIDs) for these users
- Users' Leaflet documents are stored on Leaf's own PDS
- These users can still participate in the broader ATProto network

## Architectural Overview

### Current Leaf Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          Leaf                                │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │   Client   │  │  API Server  │  │     SQLite DB       │  │
│  │   (React)  │  │    (Hono)    │  │ (users, documents)  │  │
│  └────────────┘  └──────────────┘  └─────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│            ┌────────────────────────┐                       │
│            │  ATProto OAuth Client  │                       │
│            │   (@atproto/oauth-     │                       │
│            │    client-node)        │                       │
│            └────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────┐
        │    External PDS (bsky.social)   │
        │  - Hosts user repositories      │
        │  - Issues DIDs                  │
        │  - Stores blobs                 │
        └─────────────────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────┐
        │          Jetstream              │
        │    (Real-time event feed)       │
        └─────────────────────────────────┘
```

### Proposed Architecture with Custom PDS

```
┌────────────────────────────────────────────────────────────────────────────┐
│                               Leaf                                          │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────────────────┐   │
│  │   Client   │  │  API Server  │  │            Database                │   │
│  │   (React)  │  │    (Hono)    │  │  SQLite (users, sessions, repos)   │   │
│  └────────────┘  └──────────────┘  └───────────────────────────────────┘   │
│         │               │                                                   │
│         │        ┌──────┴──────┐                                           │
│         │        │             │                                            │
│         ▼        ▼             ▼                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐    │
│  │  Social Login    │  │   Custom PDS     │  │  ATProto OAuth Client  │    │
│  │ (GitHub/Google)  │  │ (New Component)  │  │    (Existing)          │    │
│  │                  │  │                  │  │                        │    │
│  │ - OAuth2 flow    │  │ - XRPC API       │  │ - For external PDS     │    │
│  │ - DID creation   │  │ - Repository mgmt│  │   users                │    │
│  │ - Account link   │  │ - Blob storage   │  │                        │    │
│  └──────────────────┘  │ - OAuth2 server  │  └────────────────────────┘    │
│                        │ - Firehose       │                                 │
│                        └──────────────────┘                                 │
│                                │                                            │
│                                ▼                                            │
│                   ┌────────────────────────┐                               │
│                   │     PLC Directory      │                               │
│                   │  (DID registration)    │                               │
│                   └────────────────────────┘                               │
└────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                ┌─────────────────────────────────┐
                │          ATProto Relay          │
                │    (Federation/Firehose)        │
                └─────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Foundation and Infrastructure

**Duration: Large**

#### 1.1 Social Login Authentication

Add GitHub and Google OAuth2 authentication:

**New Files:**
- `server/services/social-auth.ts` - Social OAuth2 implementation
- `server/routes/social-auth.ts` - OAuth callback handlers

**Database Changes:**
```sql
-- Add social_accounts table to link social logins to users
CREATE TABLE social_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,        -- 'github' or 'google'
  provider_user_id TEXT NOT NULL,
  email TEXT,
  access_token TEXT,             -- For API calls if needed
  refresh_token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_user_id)
);

-- Modify users table
ALTER TABLE users ADD COLUMN auth_type TEXT DEFAULT 'atproto'; -- 'atproto' or 'social'
ALTER TABLE users ADD COLUMN signing_key BLOB;                  -- For social users
ALTER TABLE users ADD COLUMN rotation_key BLOB;                 -- For PLC operations
```

**Environment Variables:**
```env
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

**Implementation Details:**
1. Implement OAuth2 authorization code flow for GitHub and Google
2. Create or link user account upon successful social login
3. For new users, generate ATProto signing key and rotation key
4. Store encrypted private keys in database
5. Generate initial DID and register with PLC directory

#### 1.2 Key Management Module

**New File:** `server/services/crypto/key-management.ts`

```typescript
interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  did: string;  // Multikey format
}

// Functions needed:
// - generateSigningKey(): KeyPair (P-256 or K-256)
// - generateRotationKey(): KeyPair
// - signCommit(key: KeyPair, data: Uint8Array): Uint8Array
// - verifySignature(publicKey: Uint8Array, data: Uint8Array, sig: Uint8Array): boolean
// - exportKey(key: KeyPair): string (for storage)
// - importKey(exported: string): KeyPair
```

**Dependencies to Add:**
```json
{
  "@atproto/crypto": "^0.4.x",
  "@noble/secp256k1": "^2.x",
  "@noble/ed25519": "^2.x"
}
```

### Phase 2: PDS Core - Repository Layer

**Duration: Large**

#### 2.1 Repository Data Structures

Implement the Merkle Search Tree and repository management using `@atproto/repo`.

**New Files:**
- `server/pds/repo/mst.ts` - MST wrapper using @atproto/repo
- `server/pds/repo/commit.ts` - Commit creation and signing
- `server/pds/repo/car.ts` - CAR file handling
- `server/pds/repo/index.ts` - Repository management facade

**Database Schema:**
```sql
-- Block storage (CID -> DAG-CBOR content)
CREATE TABLE repo_blocks (
  cid TEXT PRIMARY KEY NOT NULL,
  repo_did TEXT NOT NULL,
  content BLOB NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_did) REFERENCES users(did) ON DELETE CASCADE
);

-- Repository state
CREATE TABLE repo_state (
  did TEXT PRIMARY KEY NOT NULL,
  head_cid TEXT NOT NULL,           -- Current commit CID
  rev TEXT NOT NULL,                -- TID revision
  root_cid TEXT NOT NULL,           -- MST root CID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (did) REFERENCES users(did) ON DELETE CASCADE
);

-- Record index (for fast lookups)
CREATE TABLE repo_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_did TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  cid TEXT NOT NULL,
  record_json TEXT NOT NULL,        -- JSON for fast queries
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_did) REFERENCES users(did) ON DELETE CASCADE,
  UNIQUE(repo_did, collection, rkey)
);

CREATE INDEX idx_repo_records_collection ON repo_records(repo_did, collection);
CREATE INDEX idx_repo_records_cid ON repo_records(cid);
```

**Core Repository Operations:**
```typescript
interface RepoManager {
  // Initialize a new repository for a user
  createRepo(did: string, signingKey: KeyPair): Promise<RepoState>;

  // Record operations
  createRecord(did: string, collection: string, rkey: string, record: object): Promise<CommitResult>;
  updateRecord(did: string, collection: string, rkey: string, record: object): Promise<CommitResult>;
  deleteRecord(did: string, collection: string, rkey: string): Promise<CommitResult>;

  // Batch operations (for transactions)
  applyWrites(did: string, writes: WriteOp[]): Promise<CommitResult>;

  // Read operations
  getRecord(did: string, collection: string, rkey: string): Promise<Record | null>;
  listRecords(did: string, collection: string, opts: ListOpts): Promise<Record[]>;

  // Export
  exportRepo(did: string): Promise<Uint8Array>; // CAR file
  exportRepoSlice(did: string, since: string): Promise<Uint8Array>; // Diff CAR
}
```

#### 2.2 Blob Storage

**New Files:**
- `server/pds/blob/storage.ts` - Blob storage abstraction
- `server/pds/blob/local.ts` - Local filesystem storage
- `server/pds/blob/s3.ts` - S3-compatible storage (optional)

**Database Schema:**
```sql
CREATE TABLE repo_blobs (
  cid TEXT PRIMARY KEY NOT NULL,
  repo_did TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,       -- Local path or S3 key
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_did) REFERENCES users(did) ON DELETE CASCADE
);

-- Track blob references from records
CREATE TABLE repo_blob_refs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob_cid TEXT NOT NULL,
  record_did TEXT NOT NULL,
  record_collection TEXT NOT NULL,
  record_rkey TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (blob_cid) REFERENCES repo_blobs(cid) ON DELETE CASCADE
);

CREATE INDEX idx_blob_refs_blob ON repo_blob_refs(blob_cid);
CREATE INDEX idx_blob_refs_record ON repo_blob_refs(record_did, record_collection, record_rkey);
```

**Blob Operations:**
```typescript
interface BlobStorage {
  upload(did: string, data: Uint8Array, mimeType: string): Promise<BlobRef>;
  download(cid: string): Promise<{ data: Uint8Array; mimeType: string }>;
  delete(cid: string): Promise<void>;
  addReference(blobCid: string, recordPath: RecordPath): Promise<void>;
  removeReference(blobCid: string, recordPath: RecordPath): Promise<void>;
  garbageCollect(did: string): Promise<void>; // Remove unreferenced blobs
}
```

### Phase 3: PDS Core - Identity Layer

**Duration: Medium**

#### 3.1 DID:PLC Integration

**New Files:**
- `server/pds/identity/plc.ts` - PLC directory operations
- `server/pds/identity/did-document.ts` - DID document generation

**Operations:**
```typescript
interface PLCService {
  // Create new DID:PLC
  createDid(
    signingKey: KeyPair,
    rotationKey: KeyPair,
    handle: string,
    pdsEndpoint: string
  ): Promise<string>;

  // Update DID document (handle change, key rotation, PDS migration)
  updateDid(
    did: string,
    rotationKey: KeyPair,
    updates: PLCUpdate
  ): Promise<void>;

  // Get current DID document
  resolveDid(did: string): Promise<DIDDocument>;
}
```

**PLC Directory Endpoint:** `https://plc.directory`

#### 3.2 Handle Management

**New Files:**
- `server/pds/identity/handle.ts` - Handle resolution and verification

**Handle Options for Social Users:**

1. **Subdomain handles** (Recommended): `username.leaf.example.com`
   - Requires DNS wildcard + HTTPS cert
   - Leaf manages `_atproto` TXT records

2. **Custom domain handles**: Users bring their own domain
   - User adds TXT record: `_atproto.domain.com TXT "did=did:plc:xxx"`
   - Leaf verifies via DNS lookup

**Implementation:**
```typescript
interface HandleService {
  // Generate available handle for new user
  generateHandle(username: string): Promise<string>;

  // Verify handle points to DID
  verifyHandle(handle: string, did: string): Promise<boolean>;

  // Set up DNS for subdomain handle
  provisionHandle(did: string, handle: string): Promise<void>;
}
```

### Phase 4: XRPC API Layer

**Duration: Large**

#### 4.1 XRPC Server Setup

**New Files:**
- `server/pds/xrpc/index.ts` - XRPC server setup
- `server/pds/xrpc/middleware.ts` - Auth, rate limiting
- `server/pds/xrpc/auth.ts` - Token validation

**Using @atproto/xrpc-server:**
```typescript
import { createServer } from '@atproto/xrpc-server';
import { lexicons } from './lexicons';

const xrpcServer = createServer(lexicons);

// Mount on Hono
app.use('/xrpc/*', async (c) => {
  return xrpcServer.handle(c.req.raw);
});
```

#### 4.2 com.atproto.server.* Endpoints

**File:** `server/pds/xrpc/routes/server.ts`

| Endpoint | Priority | Notes |
|----------|----------|-------|
| `describeServer` | High | Server capabilities and invite code requirement |
| `createSession` | High | Login - validate credentials, return JWT tokens |
| `refreshSession` | High | Token refresh |
| `deleteSession` | High | Logout |
| `getSession` | High | Current session info |
| `createAccount` | Medium | Not needed initially (social login creates accounts) |
| `deleteAccount` | Low | Account deletion |

#### 4.3 com.atproto.repo.* Endpoints

**File:** `server/pds/xrpc/routes/repo.ts`

| Endpoint | Priority | Notes |
|----------|----------|-------|
| `createRecord` | High | Create Leaflet document |
| `getRecord` | High | Fetch single record |
| `listRecords` | High | List records in collection |
| `deleteRecord` | High | Delete record |
| `putRecord` | High | Create or update |
| `applyWrites` | Medium | Batch operations |
| `describeRepo` | Medium | Repo metadata |
| `uploadBlob` | High | Image/media upload |

#### 4.4 com.atproto.sync.* Endpoints

**File:** `server/pds/xrpc/routes/sync.ts`

| Endpoint | Priority | Notes |
|----------|----------|-------|
| `getRepo` | High | CAR file export |
| `getBlob` | High | Download blob |
| `listBlobs` | Medium | Enumerate blobs |
| `getLatestCommit` | High | Current head |
| `subscribeRepos` | High | WebSocket firehose |

#### 4.5 com.atproto.identity.* Endpoints

**File:** `server/pds/xrpc/routes/identity.ts`

| Endpoint | Priority | Notes |
|----------|----------|-------|
| `resolveHandle` | High | Handle to DID resolution |
| `updateHandle` | Medium | Change handle |

### Phase 5: OAuth Authorization Server

**Duration: Medium**

#### 5.1 OAuth2 Implementation

Implement OAuth2 authorization server for ATProto clients.

**New Files:**
- `server/pds/oauth/authorization-server.ts`
- `server/pds/oauth/token.ts`
- `server/pds/oauth/dpop.ts`

**Required Endpoints:**
```
/.well-known/oauth-authorization-server
/.well-known/oauth-protected-resource
/oauth/authorize
/oauth/token
/oauth/par (Pushed Authorization Request)
```

**OAuth Requirements:**
- PKCE (S256) - Mandatory
- DPoP (Demonstrating Proof of Possession) - Mandatory
- PAR (Pushed Authorization Requests) - Required for security

**Token Format:**
```typescript
interface AccessToken {
  sub: string;      // DID
  iss: string;      // PDS URL
  aud: string;      // Resource server (usually same as issuer)
  scope: string;    // "atproto transition:generic"
  exp: number;      // Expiry (max 30 min)
  iat: number;
  jti: string;      // Token ID (for DPoP binding)
  cnf?: {           // DPoP confirmation
    jkt: string;    // JWK thumbprint
  };
}
```

### Phase 6: Firehose (Event Stream)

**Duration: Medium**

#### 6.1 Event Sequencer

**New Files:**
- `server/pds/firehose/sequencer.ts` - Event sequencing
- `server/pds/firehose/stream.ts` - WebSocket handler

**Database Schema:**
```sql
CREATE TABLE firehose_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_did TEXT NOT NULL,
  event_type TEXT NOT NULL,         -- 'commit', 'identity', 'account'
  commit_cid TEXT,
  rev TEXT,
  since TEXT,                       -- Previous rev
  ops TEXT,                         -- JSON array of operations
  blobs TEXT,                       -- JSON array of blob CIDs
  car_slice BLOB,                   -- CAR-encoded blocks
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_firehose_created ON firehose_events(created_at);
```

**Event Stream Implementation:**
```typescript
interface FirehoseServer {
  // Subscribe handler for com.atproto.sync.subscribeRepos
  handleSubscribe(cursor?: number): AsyncIterable<FirehoseEvent>;

  // Emit event when repository changes
  emitCommit(did: string, commit: CommitData): Promise<void>;

  // Emit identity change
  emitIdentity(did: string, handle: string): Promise<void>;

  // Emit account status change
  emitAccount(did: string, status: AccountStatus): Promise<void>;
}
```

### Phase 7: Integration

**Duration: Medium**

#### 7.1 Unified Authentication Flow

Modify existing auth to support both modes:

```typescript
// Login options
type LoginMethod =
  | { type: 'atproto-oauth'; handle: string }     // Existing ATProto OAuth
  | { type: 'app-password'; handle: string; password: string }  // Existing
  | { type: 'social'; provider: 'github' | 'google' };  // New

async function login(method: LoginMethod): Promise<AuthResult> {
  switch (method.type) {
    case 'atproto-oauth':
      return initiateAtProtoOAuth(method.handle);
    case 'app-password':
      return authenticateWithAppPassword(method.handle, method.password);
    case 'social':
      return initiateSocialOAuth(method.provider);
  }
}
```

#### 7.2 Modify Existing Post/Document Operations

Update post operations to use local PDS for social users:

```typescript
async function createPost(user: User, content: PostContent): Promise<Post> {
  if (user.auth_type === 'social') {
    // Use local PDS
    return localPds.createRecord(user.did, 'pub.leaflet.document', tid(), content);
  } else {
    // Use external PDS via ATProto agent (existing code)
    return agent.com.atproto.repo.createRecord({...});
  }
}
```

#### 7.3 Federation with Relay

Configure PDS to be crawled by the ATProto relay network:

1. **Server Metadata:**
   - Serve `/.well-known/atproto-did` with PDS service DID
   - Configure proper TLS/HTTPS

2. **Firehose Access:**
   - Make `com.atproto.sync.subscribeRepos` publicly accessible
   - Ensure proper rate limits (1,500 events/hour, 10,000/day)

3. **Relay Registration:**
   - Submit PDS to relay for crawling
   - Bluesky's relay has 10-account limit for small PDSes

### Phase 8: Testing and Validation

**Duration: Medium**

#### 8.1 Test Categories

1. **Unit Tests:**
   - MST operations
   - CID computation
   - CAR file generation
   - Signature verification
   - Token generation/validation

2. **Integration Tests:**
   - Full CRUD flow via XRPC
   - OAuth authorization flow
   - Firehose event emission
   - Blob upload/download

3. **Interoperability Tests:**
   - Verify CAR files match reference implementation
   - Test with official Bluesky app
   - Validate firehose format with relay

#### 8.2 Interop Test Files

Use official test vectors from `bluesky-social/atproto`:
- `interop-test-files/` contains language-neutral test data
- MST test cases
- CAR file samples
- Signature test vectors

## File Structure

```
server/
├── pds/
│   ├── index.ts                    # PDS initialization
│   ├── config.ts                   # PDS configuration
│   │
│   ├── crypto/
│   │   ├── index.ts
│   │   ├── keys.ts                 # Key generation/management
│   │   └── signing.ts              # Commit signing
│   │
│   ├── repo/
│   │   ├── index.ts                # Repository facade
│   │   ├── mst.ts                  # MST operations (using @atproto/repo)
│   │   ├── commit.ts               # Commit creation
│   │   ├── car.ts                  # CAR file handling
│   │   └── storage.ts              # Block storage
│   │
│   ├── blob/
│   │   ├── index.ts
│   │   ├── storage.ts              # Blob storage abstraction
│   │   └── local.ts                # Local filesystem storage
│   │
│   ├── identity/
│   │   ├── index.ts
│   │   ├── plc.ts                  # PLC directory integration
│   │   ├── did-document.ts         # DID document generation
│   │   └── handle.ts               # Handle resolution
│   │
│   ├── xrpc/
│   │   ├── index.ts                # XRPC server setup
│   │   ├── middleware.ts           # Auth, validation
│   │   └── routes/
│   │       ├── server.ts           # com.atproto.server.*
│   │       ├── repo.ts             # com.atproto.repo.*
│   │       ├── sync.ts             # com.atproto.sync.*
│   │       └── identity.ts         # com.atproto.identity.*
│   │
│   ├── oauth/
│   │   ├── index.ts                # OAuth server
│   │   ├── authorization.ts        # Authorization endpoint
│   │   ├── token.ts                # Token endpoint
│   │   └── dpop.ts                 # DPoP validation
│   │
│   └── firehose/
│       ├── index.ts
│       ├── sequencer.ts            # Event sequencing
│       └── stream.ts               # WebSocket handler
│
├── services/
│   ├── social-auth.ts              # New: Social OAuth
│   └── ... (existing files)
│
└── routes/
    ├── social-auth.ts              # New: Social auth callbacks
    └── ... (existing files)
```

## Dependencies to Add

```json
{
  "dependencies": {
    "@atproto/crypto": "^0.4.x",
    "@atproto/repo": "^0.4.x",
    "@atproto/identity": "^0.4.x",
    "@atproto/lexicon": "^0.4.x",
    "@atproto/xrpc-server": "^0.5.x",
    "@atproto/syntax": "^0.3.x",
    "@atproto/common": "^0.4.x",
    "@ipld/car": "^5.x",
    "multiformats": "^13.x"
  }
}
```

## Environment Variables

```env
# Existing
PUBLIC_URL=https://leaf.example.com
SESSION_SECRET=xxx

# New: Social Login
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# New: PDS Configuration
PDS_HOSTNAME=leaf.example.com
PDS_DID=did:web:leaf.example.com  # Or did:plc:xxx
PDS_SIGNING_KEY=xxx               # Service signing key (base64)
BLOB_STORAGE_PATH=./data/blobs    # Local blob storage
# BLOB_S3_BUCKET=xxx              # Optional: S3 storage
# BLOB_S3_ENDPOINT=xxx

# Handle Configuration
HANDLE_DOMAIN=leaf.example.com    # For username.leaf.example.com handles
```

## Risks and Mitigations

### Risk 1: Protocol Complexity
**Impact:** High
**Mitigation:** Heavy reuse of @atproto/* packages. The Bluesky team has done the hard work of implementing MST, CAR files, and cryptography correctly. We wrap their implementations rather than reimplementing.

### Risk 2: Federation Compatibility
**Impact:** High
**Mitigation:** Use official interop test files. Test against Bluesky's relay before production. Start with limited user base.

### Risk 3: Key Security
**Impact:** Critical
**Mitigation:**
- Encrypt private keys at rest
- Consider HSM or KMS for production
- Implement key rotation procedures
- Clear security documentation for users

### Risk 4: Scalability
**Impact:** Medium
**Mitigation:**
- SQLite is sufficient for moderate scale
- Blob storage can be offloaded to S3
- Consider horizontal scaling later if needed

### Risk 5: Account Portability
**Impact:** Medium
**Mitigation:**
- Implement `com.atproto.sync.getRepo` for CAR export
- Users can migrate to other PDSes
- Document migration process

## Success Criteria

1. **Social Login Works:**
   - User can sign in with GitHub/Google
   - DID is created and registered with PLC directory
   - User can create/edit/delete Leaflet documents

2. **Federation Works:**
   - Firehose events are emitted correctly
   - Relay can crawl and index the PDS
   - Other ATProto clients can fetch records

3. **Interoperability:**
   - CAR files pass validation
   - OAuth works with third-party clients
   - Handle resolution works bidirectionally

4. **Security:**
   - Private keys are encrypted at rest
   - OAuth follows ATProto spec (PKCE, DPoP, PAR)
   - Rate limiting prevents abuse

## Implementation Order Summary

1. **Phase 1:** Social login + key management (Foundation)
2. **Phase 2:** Repository layer with MST (Core data)
3. **Phase 3:** Identity/DID management (Required for Phase 4+)
4. **Phase 4:** XRPC endpoints (API surface)
5. **Phase 5:** OAuth authorization server (Client auth)
6. **Phase 6:** Firehose (Federation)
7. **Phase 7:** Integration with existing Leaf features
8. **Phase 8:** Testing and validation

Each phase builds on the previous. Phases 1-4 are required for basic functionality. Phases 5-6 are required for full ATProto compatibility. Phases 7-8 complete the integration.

## References

- [AT Protocol Specification](https://atproto.com/specs/atp)
- [Repository Specification](https://atproto.com/specs/repository)
- [XRPC Specification](https://atproto.com/specs/xrpc)
- [OAuth Specification](https://atproto.com/specs/oauth)
- [Bluesky PDS Repository](https://github.com/bluesky-social/atproto)
- [PLC Directory Specification](https://web.plc.directory/spec/v0.1/did-plc)
