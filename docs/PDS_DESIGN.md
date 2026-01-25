# Leaf Custom PDS - Design Document

## Overview

Leaf implements a custom Personal Data Server (PDS) that enables users to authenticate via GitHub or Google (social login) and participate in the AT Protocol network. This document describes the current implementation and remaining work.

## Architecture

```
+-----------------------------------------------------------------------------+
|                                 Leaf                                         |
|  +------------+  +-------------+  +----------------------------------------+ |
|  |   Client   |  | API Server  |  |               SQLite                   | |
|  |   (React)  |  |   (Hono)    |  | (users, repos, blobs, oauth, firehose) | |
|  +------------+  +-------------+  +----------------------------------------+ |
|        |               |                                                     |
|        |        +------+-------+                                             |
|        |        |              |                                             |
|        v        v              v                                             |
|  +-----------------+  +------------------+  +---------------------------+    |
|  |  Social Login   |  |   Custom PDS     |  |  ATProto OAuth Client    |    |
|  | (GitHub/Google) |  |                  |  |   (For external users)   |    |
|  |                 |  |  - XRPC API      |  |                          |    |
|  | - OAuth2 flow   |  |  - Repository    |  +---------------------------+    |
|  | - DID creation  |  |  - Blob storage  |                                   |
|  | - Account link  |  |  - OAuth server  |                                   |
|  +-----------------+  |  - Firehose      |                                   |
|                       +------------------+                                   |
|                               |                                              |
+-------------------------------|----------------------------------------------+
                                v
               +--------------------------------+
               |       PLC Directory            |
               |    (DID registration)          |
               +--------------------------------+
                                |
                                v
               +--------------------------------+
               |       ATProto Relay            |
               |    (Federation/Firehose)       |
               +--------------------------------+
```

## Implementation Status

### Completed Features

| Component | Feature | Status | Notes |
|-----------|---------|--------|-------|
| **Social Auth** | GitHub OAuth | Done | Full OAuth2 flow with PKCE |
| **Social Auth** | Google OAuth | Done | Full OAuth2 flow with PKCE |
| **Social Auth** | Account creation | Done | Auto-creates ATProto identity |
| **Social Auth** | Account linking | Done | Links social accounts to users |
| **Identity** | DID creation (did:web) | Done | For development mode |
| **Identity** | DID creation (did:plc) | Done | For production, submits to PLC directory |
| **Identity** | Handle resolution | Done | HTTPS + DNS TXT verification |
| **Identity** | Handle updates | Done | With uniqueness validation |
| **Identity** | DID document generation | Done | W3C-compliant JSON-LD |
| **Identity** | PLC operations | Done | Sign, submit, request signature |
| **Crypto** | Key generation | Done | secp256k1 and P-256 support |
| **Crypto** | Key encryption | Done | scrypt + AES-256-GCM |
| **Crypto** | Commit signing | Done | secp256k1 signatures |
| **Repository** | Record CRUD | Done | Create, read, update, delete |
| **Repository** | Atomic commits | Done | Transaction-based, signed |
| **Repository** | MST (Merkle Search Tree) | Done | Simplified single-node implementation |
| **Repository** | TID generation | Done | Thread-safe, monotonic |
| **Repository** | CAR export | Done | Full and partial (since parameter) |
| **Repository** | swapCommit validation | Done | Optimistic concurrency control |
| **Repository** | Record schema validation | Done | Known Lexicon types + basic validation |
| **Blob** | Upload/download | Done | Filesystem storage with CID |
| **Blob** | Reference tracking | Done | Links blobs to records |
| **Blob** | Garbage collection | Done | Removes orphaned blobs |
| **Firehose** | Event sequencing | Done | Auto-incrementing sequence numbers |
| **Firehose** | Commit events | Done | With CAR slices |
| **Firehose** | Identity events | Done | Handle changes |
| **Firehose** | Account events | Done | Status changes |
| **Firehose** | WebSocket streaming | Done | With cursor support |
| **OAuth Server** | Authorization endpoint | Done | With PKCE (S256) |
| **OAuth Server** | Token endpoint | Done | Access + refresh tokens |
| **OAuth Server** | PAR (Pushed Auth Request) | Done | Required for security |
| **OAuth Server** | DPoP validation | Done | Full proof validation |
| **OAuth Server** | CSRF protection | Done | Single-use tokens |
| **OAuth Server** | JWT access tokens | Done | ES256 signing with JWKS |
| **OAuth Server** | Token refresh | Done | Rotating refresh tokens |
| **XRPC** | com.atproto.server.* | Done | Session management |
| **XRPC** | com.atproto.repo.* | Done | Full record operations |
| **XRPC** | com.atproto.sync.* | Done | CAR export, blobs, firehose |
| **XRPC** | com.atproto.identity.* | Done | Handle + PLC operations |
| **Well-known** | /.well-known/atproto-did | Done | PDS DID |
| **Well-known** | /.well-known/oauth-authorization-server | Done | OAuth metadata |
| **Well-known** | /.well-known/oauth-protected-resource | Done | Resource metadata |

### Remaining TODOs

#### High Priority

| Component | Feature | Status | Notes |
|-----------|---------|--------|-------|
| **Repository** | Full MST implementation | TODO | Current impl is simplified single-node; doesn't build balanced tree based on key hashes |
| **Repository** | swapRecord validation | TODO | Validate specific record CID hasn't changed (partially parsed but not enforced) |
| **OAuth Server** | Client registration validation | TODO | Validate client_id URLs, fetch client metadata |
| **OAuth Server** | Scope validation | TODO | Validate requested scopes against ATProto spec |
| **OAuth Server** | Token revocation endpoint | TODO | `/oauth/revoke` for explicit logout |
| **XRPC** | Rate limiting | TODO | Per-endpoint and per-user limits |
| **XRPC** | Request validation | TODO | Full Lexicon schema validation for all inputs |
| **Identity** | Email verification | TODO | Verify email ownership for social users |
| **Sync** | Blob sync in partial exports | TODO | Include blobs referenced by new commits |

#### Medium Priority

| Component | Feature | Status | Notes |
|-----------|---------|--------|-------|
| **Repository** | Repo import from CAR | TODO | `com.atproto.repo.importRepo` |
| **Repository** | Repo compaction | TODO | Garbage collect old blocks |
| **Blob** | S3 storage backend | TODO | Currently filesystem only |
| **Blob** | Blob size validation | TODO | Per-type limits (images, video, etc.) |
| **Blob** | Blob MIME type validation | TODO | Whitelist allowed types |
| **Identity** | Custom domain handles | TODO | User-managed DNS verification |
| **Identity** | Handle history | TODO | Track handle changes over time |
| **Firehose** | Event compaction | TODO | Configurable retention period |
| **Firehose** | Backpressure handling | TODO | Slow consumer management |
| **OAuth Server** | Token introspection | TODO | `/oauth/introspect` endpoint |
| **Admin** | Account management UI | TODO | Admin dashboard for user management |
| **Admin** | Moderation tools | TODO | Content takedown, account suspension |

#### Low Priority

| Component | Feature | Status | Notes |
|-----------|---------|--------|-------|
| **Repository** | Proof generation | TODO | Generate inclusion proofs for records |
| **Sync** | Diff sync | TODO | Efficient delta synchronization |
| **Identity** | Key recovery | TODO | Social recovery for lost keys |
| **Identity** | Multi-device support | TODO | Multiple signing keys per user |
| **Blob** | CDN integration | TODO | Edge caching for blobs |
| **Blob** | Video transcoding | TODO | Automatic format conversion |
| **XRPC** | Metrics/observability | TODO | Prometheus metrics, tracing |
| **Testing** | Interop test suite | TODO | Validate against ATProto test vectors |
| **Testing** | Load testing | TODO | Performance benchmarks |

## Database Schema

### Tables

```sql
-- Core user table (extended)
users (
  id, did, handle, email, password_hash,
  auth_type,      -- 'atproto' | 'social'
  signing_key,    -- Encrypted private key
  rotation_key,   -- Encrypted rotation key
  created_at, updated_at
)

-- Social account links
social_accounts (
  id, user_id, provider, provider_user_id,
  email, display_name, avatar_url,
  access_token, refresh_token,
  created_at, updated_at
)

-- Repository state per user
repo_state (
  did PRIMARY KEY, head_cid, rev, root_cid,
  signing_key_id, created_at, updated_at
)

-- Record index for fast lookups
repo_records (
  id, repo_did, collection, rkey, cid, record_json,
  indexed_at
  UNIQUE(repo_did, collection, rkey)
)

-- DAG-CBOR block storage
repo_blocks (
  cid, repo_did, content BLOB, created_at
  PRIMARY KEY(cid, repo_did)
)

-- Blob metadata
repo_blobs (
  cid PRIMARY KEY, repo_did, mime_type, size,
  storage_path, temp_key, created_at
)

-- Blob reference tracking
repo_blob_refs (
  id, blob_cid, record_did, record_collection,
  record_rkey, created_at
)

-- Firehose event log
firehose_events (
  seq PRIMARY KEY, repo_did, event_type,
  commit_cid, rev, since, ops, blobs,
  car_slice BLOB, created_at
)

-- OAuth access/refresh tokens
pds_oauth_tokens (
  id, token_id UNIQUE, user_did, client_id,
  scope, dpop_jkt, access_token_hash,
  refresh_token_hash, expires_at, created_at
)

-- OAuth authorization codes
pds_oauth_codes (
  id, code UNIQUE, user_did, client_id,
  redirect_uri, scope, code_challenge,
  code_challenge_method, dpop_jkt, expires_at
)

-- PDS signing keys
pds_signing_keys (
  id PRIMARY KEY, public_key_pem,
  encrypted_private_key, encryption_salt,
  algorithm, created_at
)

-- Social OAuth state (CSRF)
social_oauth_state (
  state PRIMARY KEY, provider, redirect_uri, created_at
)
```

## XRPC Endpoints

### com.atproto.server.*
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| describeServer | GET | No | Server metadata, available providers |
| createSession | POST | No | Login (delegates to OAuth for social) |
| refreshSession | POST | Yes | Refresh access token |
| deleteSession | POST | Yes | Logout |
| getSession | GET | Yes | Current session info |

### com.atproto.repo.*
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| createRecord | POST | Yes | Create record, validates schema |
| getRecord | GET | No | Fetch single record |
| listRecords | GET | No | List records in collection |
| putRecord | POST | Yes | Create or update (upsert) |
| deleteRecord | POST | Yes | Delete record |
| applyWrites | POST | Yes | Batch operations, atomic |
| describeRepo | GET | No | Repo metadata |
| uploadBlob | POST | Yes | Upload media, returns CID |

### com.atproto.sync.*
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| getRepo | GET | No | CAR export (full or partial via `since`) |
| getBlob | GET | No | Download blob by CID |
| listBlobs | GET | No | Enumerate blobs (supports `since`) |
| getLatestCommit | GET | No | Current HEAD commit |
| getRepoStatus | GET | No | Repo status info |
| listRepos | GET | No | List all repositories |
| subscribeRepos | WS | No | Real-time firehose stream |

### com.atproto.identity.*
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| resolveHandle | GET | No | Handle -> DID resolution |
| updateHandle | POST | Yes | Change user's handle |
| getRecommendedDidCredentials | GET | Yes | Recommended key types |
| signPlcOperation | POST | Yes | Sign PLC operation |
| submitPlcOperation | POST | Yes | Submit to PLC directory |
| requestPlcOperationSignature | POST | Yes | Request directory signature |

## OAuth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /.well-known/oauth-authorization-server | GET | Server metadata |
| /.well-known/oauth-protected-resource | GET | Resource metadata |
| /oauth/authorize | GET/POST | Authorization with consent UI |
| /oauth/token | POST | Token exchange |
| /oauth/par | POST | Pushed authorization request |
| /.well-known/jwks.json | GET | Public keys for token verification |

## Security Features

### Implemented
- **PKCE (S256)**: Required for all authorization flows
- **DPoP**: Token binding via proof-of-possession
- **PAR**: Required pushed authorization requests
- **CSRF protection**: Single-use tokens on authorize form
- **Key encryption**: scrypt + AES-256-GCM for stored keys
- **JWT signing**: ES256 (P-256) for access tokens
- **swapCommit**: Optimistic concurrency control

### Pending
- Rate limiting (per-endpoint, per-user)
- Request size limits
- Input sanitization audit
- Security headers audit
- Penetration testing

## Configuration

### Environment Variables

```bash
# Required
PUBLIC_URL=https://leaf.example.com
HANDLE_DOMAIN=leaf.example.com
JWT_SECRET=<min-32-chars>
SESSION_SECRET=<min-32-chars>

# Social OAuth (at least one required for PDS)
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

# Optional
PDS_DID=did:web:leaf.example.com
PLC_DIRECTORY_URL=https://plc.directory
PLC_SUBMIT_ENABLED=true
BLOB_STORAGE_PATH=./data/blobs
MAX_BLOB_SIZE=5242880
ACCESS_TOKEN_EXPIRY=900
REFRESH_TOKEN_EXPIRY=7776000
CONTACT_EMAIL=contact@example.com
```

## File Structure

```
server/pds/
├── index.ts              # Main entry, initialization
├── config.ts             # Configuration management
├── schema.ts             # Database schema
├── utils.ts              # Validation utilities
├── crypto/
│   └── keys.ts           # Key generation/encryption
├── repo/
│   ├── index.ts          # Repository operations
│   └── storage.ts        # Block storage
├── blob/
│   └── index.ts          # Blob storage
├── firehose/
│   └── index.ts          # Event streaming
├── identity/
│   └── index.ts          # DID/handle management
├── oauth/
│   └── index.ts          # OAuth 2.0 server
├── social-auth/
│   ├── index.ts          # Social login flow
│   └── providers.ts      # Provider configs
├── xrpc/
│   ├── index.ts          # XRPC routing
│   └── routes/
│       ├── server.ts     # Session endpoints
│       ├── repo.ts       # Record endpoints
│       ├── identity.ts   # Handle/DID endpoints
│       └── sync.ts       # Sync endpoints
└── routes/
    └── social-auth.ts    # HTTP routes
```

## Known Limitations

1. **MST Implementation**: Uses simplified single-node MST rather than properly balanced tree. Works correctly but may have performance issues with very large repositories.

2. **Single Instance**: No clustering or horizontal scaling support. SQLite limits concurrent writes.

3. **Blob Storage**: Filesystem only, no S3/cloud storage backend yet.

4. **No Email Verification**: Social login users don't verify email ownership.

5. **Limited Moderation**: No built-in content moderation or takedown tools.

## Future Considerations

### Scalability
- PostgreSQL migration for higher concurrency
- Redis for session caching
- S3 for blob storage
- CDN for static content

### Federation
- Relay registration and monitoring
- Cross-PDS interactions
- Federation health checks

### Operations
- Admin dashboard
- Metrics and alerting
- Backup/restore procedures
- Migration tools

## References

- [AT Protocol Specification](https://atproto.com/specs/atp)
- [Repository Specification](https://atproto.com/specs/repository)
- [XRPC Specification](https://atproto.com/specs/xrpc)
- [OAuth Specification](https://atproto.com/specs/oauth)
- [PLC Directory Specification](https://web.plc.directory/spec/v0.1/did-plc)
- [Bluesky PDS Reference](https://github.com/bluesky-social/atproto)
