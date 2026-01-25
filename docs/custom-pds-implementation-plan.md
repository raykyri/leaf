# Custom PDS Implementation Plan for Leaf

## Executive Summary

This document outlines a plan to implement a custom Personal Data Server (PDS) for Leaf that supports users signing in via GitHub or Google. This enables users without existing Bluesky/ATProto accounts to use Leaf by creating ATProto identities backed by their social login credentials.

## Current State

### Leaf Architecture
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Hono (Node.js) + SQLite
- **Authentication**:
  - ATProto OAuth (for existing Bluesky users)
  - App password authentication (legacy fallback)
- **ATProto Integration**: Currently uses `@atproto/api` and `@atproto/oauth-client-node` as a **client** to external PDS instances

### Key Limitation
Currently, Leaf only supports users who already have ATProto accounts (e.g., on bsky.social). Users must authenticate against their existing PDS. There is no way for users to create new ATProto identities through Leaf.

---

## Proposed Solution: Leaf PDS

Build a custom PDS implementation that:
1. Allows users to sign up using GitHub or Google OAuth
2. Creates and manages `did:plc` identities for these users
3. Hosts user repositories (documents, publications, canvases)
4. Implements the ATProto XRPC API for federation
5. Provides handles under a Leaf-controlled domain (e.g., `username.leaf.pub`)

---

## Technical Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Leaf Application                          │
├─────────────────────────────────────────────────────────────────┤
│  React Frontend                                                   │
│  - Login with GitHub/Google                                       │
│  - Document/Canvas editor                                         │
│  - Profile management                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Leaf PDS (New Component)                      │
├─────────────────────────────────────────────────────────────────┤
│  XRPC API Layer (com.atproto.* endpoints)                         │
│  ├─ com.atproto.server.* (account management)                     │
│  ├─ com.atproto.repo.* (repository operations)                    │
│  ├─ com.atproto.sync.* (firehose & sync)                          │
│  └─ com.atproto.identity.* (DID/handle operations)                │
├─────────────────────────────────────────────────────────────────┤
│  Social Login Integration                                         │
│  ├─ GitHub OAuth Provider                                         │
│  └─ Google OAuth Provider                                         │
├─────────────────────────────────────────────────────────────────┤
│  Identity Management                                              │
│  ├─ did:plc creation & operations                                 │
│  ├─ Handle management (*.leaf.pub)                                │
│  └─ Signing key management                                        │
├─────────────────────────────────────────────────────────────────┤
│  Repository Storage                                               │
│  ├─ MST (Merkle Search Tree) implementation                       │
│  ├─ Record storage (SQLite + file system)                         │
│  └─ Blob storage                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Event Stream                                                     │
│  ├─ Firehose WebSocket endpoint                                   │
│  └─ Commit sequencer                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     External Services                             │
├─────────────────────────────────────────────────────────────────┤
│  plc.directory        │  Bluesky Relay      │  AppViews           │
│  (DID registration)   │  (optional sync)    │  (optional)         │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Social Login Provider
Integrates GitHub and Google OAuth to authenticate users:

```typescript
interface SocialLoginProvider {
  // Initiate OAuth flow
  authorize(provider: 'github' | 'google'): Promise<string>;

  // Handle OAuth callback
  callback(provider: 'github' | 'google', params: URLSearchParams): Promise<SocialLoginResult>;
}

interface SocialLoginResult {
  provider: 'github' | 'google';
  providerId: string;      // GitHub/Google user ID
  email: string;
  name?: string;
  avatarUrl?: string;
}
```

#### 2. Identity Manager
Creates and manages `did:plc` identities:

```typescript
interface IdentityManager {
  // Create a new did:plc for a social login user
  createIdentity(options: {
    handle: string;
    socialLogin: SocialLoginResult;
  }): Promise<{
    did: string;
    signingKey: KeyPair;
    rotationKeys: KeyPair[];
  }>;

  // Sign PLC operations
  signOperation(did: string, operation: PlcOperation): Promise<SignedPlcOperation>;

  // Update handle
  updateHandle(did: string, newHandle: string): Promise<void>;
}
```

#### 3. Repository Manager
Manages user data repositories using MST:

```typescript
interface RepositoryManager {
  // Create initial repository for new account
  createRepository(did: string): Promise<Repository>;

  // Get repository for a user
  getRepository(did: string): Promise<Repository>;

  // Create/update/delete records
  createRecord(did: string, collection: string, rkey: string, record: unknown): Promise<Commit>;
  updateRecord(did: string, collection: string, rkey: string, record: unknown): Promise<Commit>;
  deleteRecord(did: string, collection: string, rkey: string): Promise<Commit>;

  // Export repository as CAR file
  exportCar(did: string): Promise<Uint8Array>;
}
```

#### 4. XRPC Server
Implements required ATProto endpoints:

**Account Management (`com.atproto.server.*`)**
- `createSession` - Login (adapted for social login)
- `refreshSession` - Refresh access tokens
- `deleteSession` - Logout
- `getSession` - Get current session
- `describeServer` - Server capabilities
- `createAccount` - Account creation (via social login)
- `deleteAccount` - Account deletion

**Repository Operations (`com.atproto.repo.*`)**
- `createRecord` - Create a record
- `putRecord` - Create or update a record
- `deleteRecord` - Delete a record
- `getRecord` - Get a single record
- `listRecords` - List records in a collection
- `describeRepo` - Describe repository
- `uploadBlob` - Upload binary data

**Sync Operations (`com.atproto.sync.*`)**
- `getRepo` - Get full repository as CAR
- `getBlob` - Get a blob
- `listBlobs` - List blobs in repository
- `subscribeRepos` - WebSocket firehose

**Identity Operations (`com.atproto.identity.*`)**
- `resolveHandle` - Resolve handle to DID
- `updateHandle` - Update account handle
- `getRecommendedDidCredentials` - Get recommended DID credentials
- `signPlcOperation` - Sign a PLC operation

#### 5. Session Manager
Handles authentication sessions:

```typescript
interface SessionManager {
  // Create session for social login user
  createSession(did: string, provider: 'github' | 'google'): Promise<Session>;

  // Validate session token
  validateSession(token: string): Promise<Session | null>;

  // Refresh session
  refreshSession(refreshToken: string): Promise<Session>;

  // Revoke session
  revokeSession(token: string): Promise<void>;
}
```

---

## Implementation Phases

### Phase 1: Foundation (Estimated Scope: Core Infrastructure)

#### 1.1 Project Setup
- [ ] Create `server/pds/` directory structure
- [ ] Add new dependencies:
  ```json
  {
    "@atproto/repo": "^0.x",
    "@atproto/crypto": "^0.x",
    "@atproto/identity": "^0.x",
    "@atproto/xrpc-server": "^0.x",
    "@atproto/lexicon": "^0.x",
    "@atproto/common": "^0.x",
    "@did-plc/lib": "^0.x"
  }
  ```
- [ ] Set up TypeScript configuration for PDS module

#### 1.2 Database Schema Extensions
Add new tables for PDS functionality:

```sql
-- Account credentials (social login mappings)
CREATE TABLE pds_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT UNIQUE NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  social_provider TEXT NOT NULL,  -- 'github' | 'google'
  social_provider_id TEXT NOT NULL,
  signing_key_private TEXT NOT NULL,  -- Encrypted private key
  rotation_keys TEXT NOT NULL,  -- JSON array of encrypted private keys
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deactivated_at DATETIME,
  UNIQUE(social_provider, social_provider_id)
);

-- Repository commits
CREATE TABLE pds_commits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  cid TEXT UNIQUE NOT NULL,
  rev TEXT NOT NULL,
  prev_cid TEXT,
  root_cid TEXT NOT NULL,
  data BLOB NOT NULL,  -- Signed commit as CBOR
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
);

-- Repository records
CREATE TABLE pds_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  cid TEXT NOT NULL,
  value BLOB NOT NULL,  -- Record as CBOR
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(did, collection, rkey),
  FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
);

-- Blobs
CREATE TABLE pds_blobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  cid TEXT UNIQUE NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
);

-- Blob references (which records reference which blobs)
CREATE TABLE pds_blob_refs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  blob_cid TEXT NOT NULL,
  record_uri TEXT NOT NULL,
  FOREIGN KEY (blob_cid) REFERENCES pds_blobs(cid) ON DELETE CASCADE
);

-- PDS sessions (JWT-based auth)
CREATE TABLE pds_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT NOT NULL,
  access_token_hash TEXT UNIQUE NOT NULL,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (did) REFERENCES pds_accounts(did) ON DELETE CASCADE
);

-- Sequencer for firehose events
CREATE TABLE pds_sequencer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER UNIQUE NOT NULL,
  did TEXT NOT NULL,
  commit_cid TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'commit' | 'identity' | 'account'
  event_data BLOB NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 1.3 Cryptographic Key Management
Implement secure key generation and storage:

```typescript
// server/pds/crypto/keys.ts
import { Secp256k1Keypair } from '@atproto/crypto';

interface KeyManager {
  // Generate new signing keypair
  generateSigningKey(): Promise<Secp256k1Keypair>;

  // Generate rotation keypairs
  generateRotationKeys(count: number): Promise<Secp256k1Keypair[]>;

  // Encrypt private key for storage
  encryptPrivateKey(privateKey: Uint8Array, encryptionKey: Buffer): string;

  // Decrypt private key from storage
  decryptPrivateKey(encrypted: string, encryptionKey: Buffer): Uint8Array;

  // Load keypair from encrypted storage
  loadSigningKey(did: string): Promise<Secp256k1Keypair>;
}
```

### Phase 2: Social Login Integration

#### 2.1 GitHub OAuth
```typescript
// server/pds/auth/github.ts
interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

class GitHubOAuthProvider {
  async authorize(): Promise<string>;  // Returns authorization URL
  async callback(code: string): Promise<GitHubUser>;
}
```

#### 2.2 Google OAuth
```typescript
// server/pds/auth/google.ts
interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

class GoogleOAuthProvider {
  async authorize(): Promise<string>;
  async callback(code: string): Promise<GoogleUser>;
}
```

#### 2.3 Account Creation Flow
```
User clicks "Sign in with GitHub/Google"
           │
           ▼
Redirect to OAuth provider
           │
           ▼
User authorizes access
           │
           ▼
OAuth callback with authorization code
           │
           ▼
Exchange code for access token
           │
           ▼
Fetch user profile from provider
           │
           ▼
Check if account exists (by provider + provider_id)
           │
     ┌─────┴─────┐
     ▼           ▼
   Exists    New User
     │           │
     ▼           ▼
  Login     Create Account:
     │       1. Generate handle (e.g., username.leaf.pub)
     │       2. Generate signing keypair
     │       3. Generate rotation keypairs
     │       4. Create did:plc operation
     │       5. Submit to plc.directory
     │       6. Create repository
     │       7. Store account in database
     │           │
     └─────┬─────┘
           ▼
Create PDS session (access + refresh tokens)
           │
           ▼
Return session to client
```

### Phase 3: did:plc Integration

#### 3.1 DID Creation
```typescript
// server/pds/identity/plc.ts
import * as plc from '@did-plc/lib';
import { Secp256k1Keypair } from '@atproto/crypto';

class PlcIdentityManager {
  private plcClient: plc.Client;

  async createDid(options: {
    handle: string;
    signingKey: Secp256k1Keypair;
    rotationKeys: Secp256k1Keypair[];
    pdsUrl: string;
  }): Promise<string> {
    const did = await this.plcClient.createDid({
      signingKey: options.signingKey.did(),
      handle: options.handle,
      pds: options.pdsUrl,
      rotationKeys: options.rotationKeys.map(k => k.did()),
      signer: options.rotationKeys[0],  // Use first rotation key to sign
    });

    return did;
  }

  async updateHandle(did: string, newHandle: string): Promise<void>;
  async rotateKeys(did: string, newRotationKeys: Secp256k1Keypair[]): Promise<void>;
}
```

#### 3.2 Handle Management
Handles for Leaf users follow the pattern `username.leaf.pub`:

```typescript
// server/pds/identity/handles.ts
class HandleManager {
  private domain: string;  // e.g., 'leaf.pub'

  // Generate handle from social login username
  generateHandle(username: string): string {
    const sanitized = this.sanitizeUsername(username);
    return `${sanitized}.${this.domain}`;
  }

  // Verify handle availability
  async isHandleAvailable(handle: string): Promise<boolean>;

  // Resolve handle to DID (for external requests)
  async resolveHandle(handle: string): Promise<string | null>;
}
```

### Phase 4: Repository Implementation

#### 4.1 MST Implementation
Use `@atproto/repo` for the Merkle Search Tree:

```typescript
// server/pds/repo/repository.ts
import { Repo, WriteOpAction } from '@atproto/repo';

class RepositoryManager {
  async createRepository(did: string, signingKey: Secp256k1Keypair): Promise<Repo>;

  async applyWrites(
    did: string,
    writes: Array<{
      action: WriteOpAction;
      collection: string;
      rkey: string;
      record?: unknown;
    }>
  ): Promise<{
    commit: Commit;
    blobs: BlobRef[];
  }>;

  async getRecord(did: string, collection: string, rkey: string): Promise<unknown | null>;

  async listRecords(
    did: string,
    collection: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<{ records: Record[]; cursor?: string }>;

  async exportCar(did: string, since?: string): Promise<Uint8Array>;
}
```

#### 4.2 Blob Storage
```typescript
// server/pds/repo/blobs.ts
class BlobStore {
  async upload(
    did: string,
    data: Uint8Array,
    mimeType: string
  ): Promise<{ cid: string; ref: BlobRef }>;

  async get(cid: string): Promise<{ data: Uint8Array; mimeType: string } | null>;

  async delete(cid: string): Promise<void>;

  async listForDid(did: string): Promise<BlobInfo[]>;
}
```

### Phase 5: XRPC API Implementation

#### 5.1 Server Setup
```typescript
// server/pds/xrpc/server.ts
import { createServer } from '@atproto/xrpc-server';

const pdsServer = createServer({
  validateResponse: true,
  payload: {
    jsonLimit: 150 * 1024,    // 150KB JSON limit
    blobLimit: 5 * 1024 * 1024, // 5MB blob limit
  },
});

// Register lexicons
pdsServer.addLexicons(atprotoLexicons);

// Register handlers
pdsServer.method('com.atproto.server.createSession', createSessionHandler);
pdsServer.method('com.atproto.repo.createRecord', createRecordHandler);
// ... etc
```

#### 5.2 Core Endpoints Implementation

**com.atproto.server.createSession (Modified for Social Login)**
```typescript
async function createSession(ctx: Context, input: {
  // Traditional identifier/password OR social login token
  identifier?: string;
  password?: string;
  socialToken?: string;  // JWT containing social login proof
}) {
  if (input.socialToken) {
    // Validate social login token
    const claims = await verifySocialToken(input.socialToken);
    const account = await getAccountBySocialId(claims.provider, claims.providerId);

    if (!account) {
      throw new InvalidRequestError('Account not found');
    }

    return createSessionTokens(account.did);
  }

  // Traditional login flow (if needed)
  // ...
}
```

**com.atproto.repo.createRecord**
```typescript
async function createRecord(ctx: Context, input: {
  repo: string;
  collection: string;
  rkey?: string;
  validate?: boolean;
  record: unknown;
}) {
  const session = await requireAuth(ctx);

  if (session.did !== input.repo) {
    throw new AuthRequiredError('Cannot write to another user\'s repo');
  }

  // Validate against lexicon if requested
  if (input.validate !== false) {
    await validateRecord(input.collection, input.record);
  }

  // Generate rkey if not provided
  const rkey = input.rkey ?? TID.nextStr();

  // Apply write to repository
  const result = await repoManager.applyWrites(session.did, [{
    action: WriteOpAction.Create,
    collection: input.collection,
    rkey,
    record: input.record,
  }]);

  // Emit to sequencer for firehose
  await sequencer.emit({
    type: 'commit',
    did: session.did,
    commit: result.commit,
  });

  return {
    uri: `at://${session.did}/${input.collection}/${rkey}`,
    cid: result.commit.cid,
  };
}
```

#### 5.3 Firehose Implementation
```typescript
// server/pds/sync/firehose.ts
class Firehose {
  private sequencer: Sequencer;
  private connections: Set<WebSocket>;

  async subscribe(ws: WebSocket, cursor?: number): Promise<void> {
    // If cursor provided, replay events from that point
    if (cursor !== undefined) {
      const events = await this.sequencer.getEventsSince(cursor);
      for (const event of events) {
        ws.send(this.encodeEvent(event));
      }
    }

    // Add to live subscriptions
    this.connections.add(ws);

    ws.on('close', () => {
      this.connections.delete(ws);
    });
  }

  async emit(event: FirehoseEvent): Promise<void> {
    const encoded = this.encodeEvent(event);
    for (const ws of this.connections) {
      ws.send(encoded);
    }
  }
}
```

### Phase 6: Integration with Existing Leaf App

#### 6.1 Dual Authentication Support
Modify existing auth to support both external PDS and local PDS:

```typescript
// server/services/auth.ts (modified)
async function authenticateUser(
  method: 'external' | 'social',
  credentials: ExternalCredentials | SocialCredentials
): Promise<AuthResult> {
  if (method === 'social') {
    // Use local PDS
    return authenticateWithLocalPds(credentials as SocialCredentials);
  }

  // Existing flow for external PDS
  return authenticateWithExternalPds(credentials as ExternalCredentials);
}
```

#### 6.2 Frontend Updates
Add social login buttons to login page:

```typescript
// src/pages/LoginPage.tsx (modified)
function LoginPage() {
  return (
    <div>
      <h2>Sign in to Leaf</h2>

      {/* Existing ATProto login */}
      <section>
        <h3>With Bluesky Account</h3>
        <OAuthLoginForm />
      </section>

      {/* New social login */}
      <section>
        <h3>Or sign in with</h3>
        <SocialLoginButton provider="github" />
        <SocialLoginButton provider="google" />
      </section>
    </div>
  );
}
```

#### 6.3 API Routes
```typescript
// server/routes/pds-auth.ts
import { Hono } from 'hono';

const pdsAuthRoutes = new Hono();

// Social login initiation
pdsAuthRoutes.get('/auth/social/:provider', async (c) => {
  const provider = c.req.param('provider');
  const authUrl = await socialLoginProvider.authorize(provider);
  return c.redirect(authUrl);
});

// Social login callback
pdsAuthRoutes.get('/auth/social/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  const params = new URLSearchParams(c.req.query());

  const result = await socialLoginProvider.callback(provider, params);

  if (result.isNewUser) {
    // Create did:plc and account
    const account = await createSocialAccount(result);
  }

  // Create session and redirect
  const session = await sessionManager.createSession(result.did);
  return c.redirect('/profile');
});

// XRPC endpoints
pdsAuthRoutes.all('/xrpc/:method', xrpcHandler);
```

### Phase 7: Testing and Validation

#### 7.1 Unit Tests
- Key generation and encryption
- MST operations
- CBOR serialization
- DID operations

#### 7.2 Integration Tests
- Full account creation flow
- Record creation/update/delete
- Firehose event emission
- Cross-PDS sync (with Bluesky relay)

#### 7.3 Federation Testing
- Verify repositories can be read by external services
- Verify firehose events are properly formatted
- Verify DID documents are correctly published

---

## Dependencies and Libraries

### Required npm Packages

```json
{
  "@atproto/repo": "^0.5.x",
  "@atproto/crypto": "^0.4.x",
  "@atproto/identity": "^0.4.x",
  "@atproto/xrpc-server": "^0.6.x",
  "@atproto/lexicon": "^0.4.x",
  "@atproto/common": "^0.4.x",
  "@atproto/syntax": "^0.3.x",
  "@did-plc/lib": "^0.0.x",
  "multiformats": "^13.x"
}
```

### Environment Variables

```env
# Leaf PDS Configuration
PDS_HOSTNAME=leaf.pub
PDS_PORT=3335
PDS_JWT_SECRET=<random-32-bytes>
PDS_KEY_ENCRYPTION_SECRET=<random-32-bytes>

# PLC Directory
PLC_DIRECTORY_URL=https://plc.directory

# GitHub OAuth
GITHUB_CLIENT_ID=<client-id>
GITHUB_CLIENT_SECRET=<client-secret>

# Google OAuth
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
```

---

## Directory Structure

```
server/
├── pds/
│   ├── index.ts                 # PDS entry point
│   ├── config.ts                # Configuration
│   ├── auth/
│   │   ├── github.ts            # GitHub OAuth provider
│   │   ├── google.ts            # Google OAuth provider
│   │   └── session.ts           # Session management
│   ├── identity/
│   │   ├── plc.ts               # did:plc operations
│   │   ├── handles.ts           # Handle management
│   │   └── keys.ts              # Key management
│   ├── repo/
│   │   ├── repository.ts        # Repository manager
│   │   ├── mst.ts               # MST wrapper
│   │   ├── blobs.ts             # Blob storage
│   │   └── car.ts               # CAR file export
│   ├── sync/
│   │   ├── firehose.ts          # WebSocket firehose
│   │   └── sequencer.ts         # Event sequencer
│   ├── xrpc/
│   │   ├── server.ts            # XRPC server setup
│   │   └── handlers/
│   │       ├── server.ts        # com.atproto.server.*
│   │       ├── repo.ts          # com.atproto.repo.*
│   │       ├── sync.ts          # com.atproto.sync.*
│   │       └── identity.ts      # com.atproto.identity.*
│   └── database/
│       ├── schema.ts            # PDS-specific tables
│       └── queries.ts           # Database operations
├── routes/
│   ├── pds-auth.ts              # Social login routes
│   └── pds-xrpc.ts              # XRPC route handler
└── ...existing files...
```

---

## Security Considerations

### 1. Private Key Protection
- All signing keys stored encrypted at rest using AES-256-GCM
- Encryption key derived from environment secret using HKDF
- Keys never logged or exposed in API responses

### 2. Session Security
- Short-lived access tokens (15 minutes)
- Longer refresh tokens (30 days)
- Tokens bound to user agent and IP
- Secure cookie storage with HttpOnly, Secure, SameSite=Strict

### 3. Rate Limiting
- Account creation: 5/hour per IP
- Login attempts: 10/15min per IP
- Record writes: 100/hour per account
- Blob uploads: 50/hour per account

### 4. Input Validation
- All XRPC inputs validated against Lexicon schemas
- Record content validated against collection lexicons
- Handle format validation
- Blob type and size restrictions

### 5. Social Login Security
- PKCE for OAuth flows
- State parameter validation
- Nonce validation for OpenID Connect (Google)
- Token verification before account creation

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| plc.directory downtime | Users can't create accounts | Implement retry with backoff; queue operations |
| Key compromise | Account takeover | Rotation key hierarchy; encourage key backup |
| Database corruption | Data loss | Regular backups; WAL mode; integrity checks |
| Federation incompatibility | Isolation from network | Comprehensive conformance testing |
| Social provider deprecation | Auth flow breaks | Support multiple providers; migration path |

---

## Alternative Approaches Considered

### 1. Embedding Bluesky PDS
**Pros**: Full compatibility, maintained by Bluesky
**Cons**: Heavy (many dependencies), designed for standalone deployment, hard to customize for social login

### 2. did:web Instead of did:plc
**Pros**: Simpler (just DNS/HTTP), self-hosted
**Cons**: Less portable, requires domain ownership verification, can't rotate keys independently

### 3. Proxy to Existing PDS
**Pros**: No new PDS code needed
**Cons**: Users still need external accounts, doesn't solve the core problem

### 4. Wait for Official Social Login Support
**Pros**: No custom code
**Cons**: Not on Bluesky roadmap, may never happen

---

## Success Metrics

1. **Functional**: Users can sign up with GitHub/Google and create Leaflet documents
2. **Compatible**: Documents created on Leaf PDS are visible on other ATProto clients
3. **Performant**: Record operations < 100ms, account creation < 2s
4. **Reliable**: 99.9% uptime, zero data loss
5. **Secure**: Pass security audit, no key exposure incidents

---

## Conclusion

Implementing a custom PDS for Leaf is a significant undertaking, but it's feasible using the existing `@atproto/*` packages as building blocks. The key innovations are:

1. Social login integration for account creation
2. Automatic did:plc identity provisioning
3. Handle management under a Leaf domain

This approach enables Leaf to serve users who don't have existing ATProto accounts while maintaining full federation compatibility with the broader ATProto network.

---

## References

- [AT Protocol Specification](https://atproto.com/specs)
- [ATProto Repository Format](https://atproto.com/specs/repository)
- [did:plc Specification](https://web.plc.directory/spec/v0.1/did-plc)
- [XRPC Specification](https://atproto.com/specs/xrpc)
- [Bluesky PDS Reference Implementation](https://github.com/bluesky-social/atproto/tree/main/packages/pds)
- [@atproto/repo NPM Package](https://www.npmjs.com/package/@atproto/repo)
- [@did-plc/lib Package](https://github.com/did-method-plc/did-method-plc)
