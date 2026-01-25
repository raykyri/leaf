# Leaf PDS Implementation Plan

## Executive Summary
This document outlines the plan to integrate a Personal Data Server (PDS) into the Leaf application. This will allow users to sign in via GitHub or Google, automatically provision a decentralized identity (DID), and host their data directly on the Leaf infrastructure. The implementation will be built in TypeScript, integrated into the existing Hono server, and designed to scale vertically on a single VPS.

## 1. Architecture Overview

The PDS will be embedded directly into the existing Leaf Node.js/Hono server rather than running as a separate microservice. This reduces operational complexity and resource overhead.

### Core Components
1.  **XRPC Server**: A dedicated router mounted at `/xrpc` handling AT Protocol requests.
2.  **Repo Host**: A module responsible for managing Merkle Search Trees (MST), signing commits, and storing IPLD blocks.
3.  **Identity Manager**: Handles DID provisioning (via `did:plc` or `did:web`) and resolving.
4.  **Block Storage**: An abstraction for storing content-addressed data (IPLD blocks).
5.  **Federation Bus**: A WebSocket-based firehose (`com.atproto.sync.subscribeRepos`) to broadcast updates to the network (Relays/AppViews).

### Technology Stack
-   **Runtime**: Node.js (Existing)
-   **Framework**: Hono (Existing)
-   **Database**: SQLite (`better-sqlite3`) (Existing)
-   **ATProto Libraries**: `@atproto/repo`, `@atproto/lexicon`, `@atproto/common`, `@atproto/identity`.

## 2. Detailed Implementation Steps

### Phase 1: Dependencies & Core Infrastructure

1.  **Install Libraries**:
    -   `@atproto/repo`: For MST manipulation.
    -   `@atproto/lexicon`: For validating records against schemas.
    -   `@atproto/common` & `@atproto/crypto`: For cryptographic operations (signing).
    -   `multiformats`: For CID and bytes handling.

2.  **Database Schema Extensions**:
    -   **`blocks` table**: To store IPLD blocks (CID, data).
    -   **`repo_roots` table**: To track the current root CID for each user's repo.
    -   **`repo_ops` table**: To log operations for the firehose (sequencer).
    -   **`local_auth` table**: To map external identity providers (Google/GitHub subjects) to DIDs.

3.  **Blockstore Implementation**:
    -   Implement a generic `Blockstore` interface backed by the `blocks` SQLite table.
    -   *Optimization*: For larger scale, this can be swapped for a filesystem or S3 backend later.

### Phase 2: Identity & Authentication

1.  **DID Provisioning**:
    -   Implement a `DidManager` service.
    -   **Strategy**: Use `did:plc` for portability. The PDS will act as the "Rotation Key" holder initially.
    -   **Registration**: When a user logs in via OAuth (Google/GitHub) for the first time:
        1.  Generate a signing keypair (secp256k1).
        2.  Call PLC directory to create a DID.
        3.  Store the private key securely (encrypted at rest).
        4.  Create a "Genesis Commit" for their repository.

2.  **Authentication Handlers**:
    -   Update `auth.ts` to handle PDS-hosted users.
    -   Implement `com.atproto.server.createSession` (and refresh).
    -   Issue Access/Refresh JWTs signed by the PDS.

### Phase 3: Repository Management

1.  **Repo Service**:
    -   Create `RepoService` to handle high-level operations: `createRecord`, `putRecord`, `deleteRecord`.
    -   This service manages the *Repo Transactor*: locks the repo, applies the change to the MST, saves new blocks, updates the root, and signs the commit.

2.  **XRPC Implementation (Repo)**:
    -   Implement `com.atproto.repo.*` methods:
        -   `getRecord`, `listRecords` (Read from DB/MST).
        -   `createRecord`, `putRecord`, `deleteRecord` (Write via RepoService).
        -   `describeRepo`.

### Phase 4: Federation & Sync

1.  **Sync Routes**:
    -   Implement `com.atproto.sync.*`:
        -   `getRepo`: Return a CAR file of the user's repo.
        -   `getCheckout`, `getHead`, `getRecord`.

2.  **The Firehose (WebSocket)**:
    -   Implement `com.atproto.sync.subscribeRepos`.
    -   Use `repo_ops` table to act as a sequencer.
    -   When a write happens, emit an event to connected listeners (Relays).

### Phase 5: Leaf Integration

1.  **User Unified View**:
    -   Ensure Leaf's frontend can talk to its own backend as a PDS.
    -   The `AtpAgent` in the frontend will point to `https://leaf-server.com` (or local).

2.  **Data Migration (Optional)**:
    -   If existing users want to migrate to PDS storage, a migration tool will be needed.

## 3. Database Schema Proposed Changes

```sql
-- Store content-addressed blocks
CREATE TABLE blocks (
    cid TEXT PRIMARY KEY,
    data BLOB NOT NULL,
    size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Track repository state
CREATE TABLE repo_roots (
    did TEXT PRIMARY KEY,
    root_cid TEXT NOT NULL,
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sequencer for Firehose
CREATE TABLE repo_seq (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    did TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'commit', 'handle', etc.
    data BLOB NOT NULL, -- Encoded event data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Map OAuth identities to DIDs
CREATE TABLE oauth_identities (
    provider TEXT NOT NULL, -- 'google', 'github'
    subject_id TEXT NOT NULL,
    did TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider, subject_id),
    FOREIGN KEY (did) REFERENCES users(did)
);
```

## 4. Development Roadmap

1.  **Week 1**: Core Setup & Storage. Implement Blockstore and Repo logic.
2.  **Week 2**: Identity & Auth. Connect OAuth flow to DID creation.
3.  **Week 3**: XRPC API. Implement `com.atproto.repo` and `server` methods.
4.  **Week 4**: Federation. Implement `sync` routes and WebSocket firehose.

## 5. Security Considerations

-   **Key Management**: User signing keys must be protected. Ideally encrypted with a master key derived from environment variables.
-   **Rate Limiting**: Critical for public XRPC endpoints to prevent abuse.
-   **Content Validation**: Ensure records match Lexicons before storage.

## 6. Scalability

-   **Read Heavy**: SQLite is very fast for reads.
-   **Write Volume**: The single-threaded write lock (per user) for MST updates is sufficient for typical social media usage.
-   **Storage**: Moving `blocks` to S3 allows infinite storage scaling while keeping the index (SQLite) lightweight.
