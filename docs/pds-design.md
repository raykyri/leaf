# Leaf PDS Design Document

## Overview

The Leaf PDS (Personal Data Server) is an ATProto-compatible server that enables users to authenticate via social login (GitHub/Google) and manage their decentralized identity and data repositories. It implements the full ATProto specification with MST-based repositories, blob storage, and relay communication.

**Key differentiator:** Unlike traditional ATProto PDSs that use password authentication, Leaf PDS uses OAuth-based social login, making it easier for users to get started while maintaining full ATProto compatibility.

---

## Architecture

### Directory Structure

```
server/pds/
├── index.ts                    # Main entry point, route setup
├── config.ts                   # Configuration management
├── auth/                       # OAuth/Social login
│   ├── github.ts              # GitHub OAuth implementation
│   ├── google.ts              # Google OAuth implementation
│   └── session.ts             # JWT session management
├── database/                   # Data persistence
│   ├── schema.ts              # SQLite schema definitions
│   └── queries.ts             # Database operations
├── identity/                   # Identity management
│   ├── handles.ts             # Handle registration/resolution
│   ├── keys.ts                # Key generation/encryption
│   └── plc.ts                 # PLC directory integration
├── repo/                       # Repository management
│   ├── repository.ts          # MST-based repo operations
│   ├── blobs.ts               # Blob storage/retrieval
│   └── car.ts                 # CAR file export
├── sync/                       # Synchronization
│   ├── relay.ts               # Relay communication
│   └── firehose.ts            # WebSocket event stream
├── xrpc/                       # XRPC protocol
│   ├── server.ts              # Router setup
│   └── handlers/
│       ├── server.ts          # com.atproto.server.*
│       ├── repo.ts            # com.atproto.repo.*
│       ├── identity.ts        # com.atproto.identity.*
│       └── sync.ts            # com.atproto.sync.*
├── validation/                 # Input validation
│   └── index.ts               # NSID, rkey, DID validation
└── middleware/
    └── ratelimit.ts           # Rate limiting
```

---

## Core Components

### 1. Authentication (`auth/`)

#### Social Login Flow

```
User clicks "Login with GitHub/Google"
    ↓
PDS generates PKCE challenge + state
    ↓
Redirect to OAuth provider
    ↓
Provider authenticates user
    ↓
Callback with authorization code
    ↓
PDS exchanges code for user info
    ↓
Create/retrieve account
    ↓
Generate JWT session tokens
    ↓
User logged in
```

#### Session Management

- **Access Token:** 15-minute JWT for API requests
- **Refresh Token:** 30-day JWT for token renewal
- Tokens signed with `PDS_JWT_SECRET`
- Hashed tokens stored in database for revocation

#### Key Files

| File | Purpose |
|------|---------|
| `github.ts` | GitHub OAuth flow, user info extraction |
| `google.ts` | Google OAuth flow, user info extraction |
| `session.ts` | JWT creation, validation, refresh |

---

### 2. Identity Management (`identity/`)

#### Handle System

- Format: `username.domain` (e.g., `alice.leaf.pub`)
- Max 253 characters, segments max 63 characters
- Alphanumeric and hyphens only
- Reserved handles: admin, system, bsky, atproto, etc.

#### Key Management

- **Signing Key:** secp256k1 for repository commits
- **Rotation Keys:** 2-3 secp256k1 keys for identity recovery
- Keys encrypted at rest with AES-256-GCM
- Unique 12-byte IV per key

#### DID Operations

- Creates `did:plc` identities via PLC Directory
- Supports handle updates, PDS migration, key rotation
- Signs operations with rotation keys

#### Handle Resolution

1. Local database lookup
2. External HTTPS well-known endpoint
3. DNS TXT record fallback

---

### 3. Repository Management (`repo/`)

#### MST (Merkle Search Tree)

The repository uses a Merkle Search Tree for efficient, verifiable storage:

```
                    [Root]
                   /      \
              [Node]      [Node]
             /    \       /    \
          [Leaf] [Leaf] [Leaf] [Leaf]
```

- Keys sorted lexicographically
- Tree depth based on key hash
- Each node is a CBOR-encoded block
- Root CID changes on any modification

#### Repository Structure

```typescript
class RepositoryManager {
  did: string
  blockStore: BlockStore      // In-memory block cache
  mst: MST                    // Merkle Search Tree
  currentHead: CID | null     // Latest commit CID
  currentRev: string | null   // Latest revision TID
}
```

#### Record Operations

| Operation | Atomic Guarantees |
|-----------|-------------------|
| `createRecord` | swapCommit verification |
| `updateRecord` | swapCommit + swapRecord verification |
| `deleteRecord` | swapCommit + swapRecord verification |
| `applyWrites` | All-or-nothing transaction |

#### Blob Storage

- MIME type whitelist (images, PDF, video, audio)
- Magic number validation for images
- 5MB default size limit
- Reference counting for garbage collection

---

### 4. Synchronization (`sync/`)

#### Firehose

WebSocket event stream for real-time updates:

```typescript
{
  $type: "com.atproto.sync.subscribeRepos#commit"
  seq: number              // Monotonic sequence
  did: string              // Repository DID
  time: string             // ISO 8601 timestamp
  commit: { cid, rev }     // Commit info
  ops: [{                  // Operations
    action: 'create' | 'update' | 'delete'
    path: "collection/rkey"
    cid: string | null
  }]
}
```

#### Relay Communication

- Register/unregister relays
- Notify relays of updates
- Request crawls
- Subscribe to relay firehose
- Announce on startup

---

### 5. XRPC Handlers

#### Server Endpoints (`com.atproto.server.*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `describeServer` | GET | Server capabilities |
| `createSession` | POST | Password auth (returns 401 for social) |
| `refreshSession` | POST | Refresh tokens |
| `getSession` | GET | Current session info |
| `deleteSession` | POST | Logout |

#### Repository Endpoints (`com.atproto.repo.*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `describeRepo` | GET | Repository metadata |
| `createRecord` | POST | Create new record |
| `putRecord` | POST | Create or update record |
| `deleteRecord` | POST | Delete record |
| `getRecord` | GET | Retrieve single record |
| `listRecords` | GET | List collection with pagination |
| `uploadBlob` | POST | Upload binary data |
| `applyWrites` | POST | Atomic multi-operation |

#### Identity Endpoints (`com.atproto.identity.*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `resolveHandle` | GET | Handle to DID resolution |
| `updateHandle` | POST | Change handle |
| `signPlcOperation` | POST | Sign DID update |
| `submitPlcOperation` | POST | Submit to PLC Directory |

#### Sync Endpoints (`com.atproto.sync.*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `getRepo` | GET | Export repository as CAR |
| `getLatestCommit` | GET | Current head and revision |
| `getRepoStatus` | GET | Repository status |
| `getBlob` | GET | Retrieve blob by CID |
| `listBlobs` | GET | List blobs with pagination |
| `getRecord` | GET | Export record as CAR |
| `getBlocks` | GET | Retrieve blocks by CID |
| `listRepos` | GET | List all repositories |
| `subscribeRepos` | WS | Firehose subscription |

---

## Database Schema

### Tables

```sql
pds_accounts
  - did (PRIMARY KEY)
  - handle (UNIQUE)
  - email
  - social_provider, social_provider_id
  - signing_key, rotation_keys (encrypted)
  - recovery_key
  - created_at, deactivated_at

pds_commits
  - did, cid (UNIQUE)
  - rev, prev_cid, root_cid
  - data (signed commit block)

pds_records
  - did, collection, rkey (UNIQUE combination)
  - cid, value (CBOR-encoded)
  - indexed_at

pds_blobs
  - did, cid (UNIQUE)
  - mime_type, size, data

pds_blob_refs
  - blob_cid, record_uri (UNIQUE combination)

pds_sessions
  - did
  - access_token_hash, refresh_token_hash
  - expires_at, created_at

pds_sequencer
  - seq (monotonic)
  - did, commit_cid
  - event_type, event_data
  - created_at

pds_repo_state
  - did (PRIMARY KEY)
  - head_cid, head_rev
  - updated_at

pds_oauth_state
  - state (PRIMARY KEY)
  - provider, data (JSON)
  - created_at
```

### Relationships

```
pds_accounts (1)
  ├─── (1:N) pds_commits
  ├─── (1:N) pds_records
  ├─── (1:N) pds_blobs
  ├─── (1:N) pds_sessions
  ├─── (1:N) pds_sequencer
  └─── (1:1) pds_repo_state

pds_blobs (1)
  └─── (1:N) pds_blob_refs
```

---

## Security

### Cryptography

| Component | Algorithm |
|-----------|-----------|
| Key encryption | AES-256-GCM |
| Key derivation | HKDF-SHA256 |
| Signing | secp256k1 ECDSA |
| Hashing | SHA-256 |
| JWT signing | HS256 |

### Rate Limiting

| Operation Type | Limit |
|----------------|-------|
| Standard | 100 req/min |
| Write | 30 req/min |
| Auth | 10 req/min |
| Upload | 20 req/min |
| Read | 300 req/min |

### Input Validation

- NSID validation for collection names
- Record key format validation
- DID format validation
- Blob MIME type whitelist
- Magic number validation for images
- Path traversal prevention

---

## Configuration

### Required Environment Variables

```bash
# Server
PDS_HOSTNAME=example.com
PDS_PORT=3334
PUBLIC_URL=https://example.com

# Cryptography
PDS_JWT_SECRET=<random 32+ chars>
PDS_KEY_ENCRYPTION_SECRET=<random 32+ chars>

# OAuth
GITHUB_CLIENT_ID=<from GitHub>
GITHUB_CLIENT_SECRET=<from GitHub>
GOOGLE_CLIENT_ID=<from Google>
GOOGLE_CLIENT_SECRET=<from Google>

# PLC Directory
PLC_DIRECTORY_URL=https://plc.directory

# Limits
PDS_MAX_BLOB_SIZE=5242880      # 5MB
PDS_MAX_RECORD_SIZE=153600     # 150KB

# Handles
PDS_HANDLE_DOMAIN=example.com
```

---

## API Error Codes

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| `AuthRequired` | 401 | Missing/invalid authentication |
| `InvalidRequest` | 400 | Bad parameters |
| `InvalidSwap` | 400 | Optimistic locking conflict |
| `RepoNotFound` | 404 | Repository doesn't exist |
| `RecordNotFound` | 404 | Record doesn't exist |
| `HandleNotAvailable` | 400 | Handle already taken |
| `RateLimitExceeded` | 429 | Too many requests |
| `InternalError` | 500 | Server error |

---

## Remaining TODOs

### High Priority

- [ ] **Admin Authentication Layer**
  - Currently no admin-only authentication
  - Need secure admin endpoints for relay management, user moderation
  - Consider API keys or separate admin JWT scope

- [ ] **Persistent Block Storage**
  - BlockStore is currently in-memory only
  - Need to persist MST blocks to database
  - Required for server restarts and large repositories

- [ ] **Account Deactivation Flow**
  - Partial implementation exists
  - Need complete UI flow
  - Handle DID tombstoning properly

- [ ] **Email Verification**
  - Currently no email verification for social login accounts
  - Consider optional email verification for account recovery

### Medium Priority

- [ ] **Account Migration**
  - Export account with keys
  - Import to another PDS
  - Handle key transfer securely

- [ ] **Key Rotation UI**
  - Rotation keys exist but no user-facing rotation flow
  - Need secure key rotation with backup verification

- [ ] **Redis-based Rate Limiting**
  - Current implementation is in-memory
  - Need Redis for distributed deployments

- [ ] **Database-triggered Events**
  - Current firehose uses polling (100ms)
  - Consider PostgreSQL NOTIFY or similar for real-time

- [ ] **Moderation Tools**
  - Report handling
  - Content takedown
  - User suspension

- [ ] **Backup and Restore**
  - Automated backups
  - Point-in-time recovery
  - Disaster recovery plan

### Low Priority

- [ ] **Full-text Search**
  - Index records for search
  - Consider SQLite FTS5 or external search

- [ ] **Multi-PDS Federation Testing**
  - Test with multiple PDS instances
  - Handle resolution across PDSs
  - Repository migration

- [ ] **Admin Dashboard**
  - Web UI for PDS administration
  - User management
  - Relay status monitoring
  - System health metrics

- [ ] **Metrics and Observability**
  - Prometheus metrics
  - Request tracing
  - Error tracking

- [ ] **Apple Sign-In**
  - Additional OAuth provider
  - Requires Apple Developer account

- [ ] **WebAuthn/Passkeys**
  - Passwordless authentication option
  - FIDO2 support

### Technical Debt

- [ ] **MST Optimization**
  - Current implementation rebuilds tree on each operation
  - Consider incremental updates for better performance

- [ ] **Connection Pooling**
  - Database connection management
  - WebSocket connection limits

- [ ] **Graceful Shutdown**
  - Complete in-flight requests
  - Close WebSocket connections cleanly
  - Flush pending events

- [ ] **Integration Tests**
  - End-to-end OAuth flow tests
  - Repository operation tests
  - Sync/relay tests

- [ ] **Documentation**
  - API documentation (OpenAPI/Swagger)
  - Deployment guide
  - Troubleshooting guide

---

## Data Flow Diagrams

### Record Creation

```
Client POST /xrpc/com.atproto.repo.createRecord
    │
    ▼
┌─────────────────────────────────────┐
│ XRPC Handler (repo.ts)              │
│ • Validate auth token               │
│ • Validate collection/rkey          │
│ • Verify repo ownership             │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ RepositoryManager                   │
│ • Verify swapCommit                 │
│ • Encode record to CBOR             │
│ • Add to MST                        │
│ • Create signed commit              │
└────────────────┬────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐ ┌───────────────────┐
│ Database      │ │ Sequencer         │
│ • pds_records │ │ • Emit event      │
│ • pds_commits │ │ • Notify firehose │
│ • repo_state  │ │ • Notify relays   │
└───────────────┘ └───────────────────┘
```

### Social Login

```
User clicks "Login with GitHub"
    │
    ▼
┌─────────────────────────────────────┐
│ GET /pds/auth/github                │
│ • Generate PKCE challenge           │
│ • Store state in database           │
│ • Redirect to GitHub                │
└────────────────┬────────────────────┘
                 │
                 ▼
        GitHub OAuth Server
                 │
                 ▼
┌─────────────────────────────────────┐
│ GET /pds/auth/github/callback       │
│ • Validate state                    │
│ • Exchange code for token           │
│ • Fetch user info                   │
└────────────────┬────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐ ┌───────────────────┐
│ New User      │ │ Existing User     │
│ • Gen keys    │ │ • Load account    │
│ • Create DID  │ │                   │
│ • Store acct  │ │                   │
└───────┬───────┘ └─────────┬─────────┘
        └────────┬──────────┘
                 ▼
┌─────────────────────────────────────┐
│ Create Session                      │
│ • Generate JWT tokens               │
│ • Store hashed tokens               │
│ • Set cookie & redirect             │
└─────────────────────────────────────┘
```

---

## Deployment Considerations

### Minimum Requirements

- Node.js 18+
- SQLite 3.35+ (for JSON functions)
- 512MB RAM minimum
- Persistent storage for database

### Production Recommendations

- PostgreSQL for larger deployments
- Redis for rate limiting and sessions
- Reverse proxy (nginx/Caddy) for TLS
- Object storage (S3/R2) for blobs
- CDN for static assets

### Environment-Specific Notes

| Environment | Database | Rate Limit | Relay |
|-------------|----------|------------|-------|
| Development | SQLite | In-memory | None |
| Staging | SQLite | In-memory | Test relay |
| Production | PostgreSQL | Redis | bsky.network |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2024-01 | Initial implementation |
| 0.2.0 | 2024-01 | MST, sync endpoints, atomic writes |
| 0.3.0 | 2024-01 | Relay communication, handle verification |

---

## References

- [ATProto Specification](https://atproto.com/specs)
- [PLC Directory](https://web.plc.directory/)
- [Bluesky PDS Reference](https://github.com/bluesky-social/pds)
- [CBOR Specification](https://cbor.io/)
- [CAR Format](https://ipld.io/specs/transport/car/)
