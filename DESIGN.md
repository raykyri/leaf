# Leaflet ATProto Blogging Platform - Design Document

## Overview

A minimalist blogging platform built on the AT Protocol using the Leaflet lexicon for rich document publishing. The application allows users to sign up with their ATProto credentials, indexes their existing Leaflet documents from their PDS, and subscribes to real-time updates via Jetstream.

## Architecture

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js for HTTP server
- **Database**: SQLite (via better-sqlite3) for simplicity and portability
- **ATProto SDK**: @atproto/api for PDS communication
- **Real-time Updates**: Jetstream WebSocket client
- **Frontend**: Server-side rendered HTML with minimal CSS

### Core Components

1. **Authentication Service**
   - Handles user login with ATProto handle and app password
   - Uses `@atproto/api` AtpAgent which handles DID resolution internally
   - Creates AtpAgent instance and authenticates via `agent.login()`
   - Stores ATProto session tokens (accessJwt, refreshJwt) in database for session resumption
   - Creates and manages application-level sessions with HTTP-only cookies

2. **PDS Indexer**
   - Queries user's PDS for existing Leaflet documents
   - Uses `com.atproto.repo.listRecords` API with cursor-based pagination
   - Fetches collections: `pub.leaflet.document`, `pub.leaflet.publication`
   - Parses records and extracts required fields (title, pages, etc.)
   - Stores document records in local database
   - Runs on initial user login (for new users) and on-demand refresh
   - Handles large repositories efficiently with cursors

3. **Jetstream Listener**
   - Maintains WebSocket connection to Jetstream
   - Filters for events from registered users only (with DID caching for performance)
   - Processes create/update/delete operations for Leaflet documents
   - Handles identity events to sync handle changes
   - Updates local database in real-time

4. **Document Storage**
   - Local SQLite database caching Leaflet documents
   - Stores essential metadata and content for fast retrieval
   - Maintains relationships between users, publications, and documents

5. **Post Creation Service**
   - Allows authenticated users to create new Leaflet documents
   - Uses @atproto/api to write records to user's PDS
   - Supports basic linearDocument page format with text blocks

6. **HTML Renderer**
   - Converts Leaflet linearDocument blocks to HTML
   - Renders minimalist, readable blog pages
   - Generates index pages listing all posts from registered users

## Data Model

### Database Schema

```sql
-- Users who have signed up for the application
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  did TEXT UNIQUE NOT NULL,           -- User's DID
  handle TEXT NOT NULL,                -- User's handle (e.g., @alice.bsky.social)
  display_name TEXT,                   -- Optional display name
  pds_url TEXT NOT NULL,               -- User's PDS endpoint
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_indexed_at DATETIME             -- Last time we indexed their PDS
);

-- Publications (collections of documents)
CREATE TABLE publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT UNIQUE NOT NULL,            -- AT-URI of the publication record
  user_id INTEGER NOT NULL,
  rkey TEXT NOT NULL,                  -- Record key
  name TEXT NOT NULL,
  description TEXT,
  base_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Documents (blog posts)
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT UNIQUE NOT NULL,            -- AT-URI of the document record
  user_id INTEGER NOT NULL,
  publication_id INTEGER,              -- Optional reference to publication
  rkey TEXT NOT NULL,                  -- Record key
  title TEXT NOT NULL,
  description TEXT,
  author TEXT NOT NULL,                -- DID of the author
  content TEXT NOT NULL,               -- JSON serialized pages array
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (publication_id) REFERENCES publications(id) ON DELETE SET NULL
);

-- Session management
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  access_jwt TEXT,                     -- ATProto access token for PDS operations
  refresh_jwt TEXT,                    -- ATProto refresh token
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_published_at ON documents(published_at DESC);
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_users_did ON users(did);
CREATE INDEX idx_users_handle ON users(handle);
```

## API Endpoints

### Authentication

- `GET /` - Landing page with login/signup form
- `GET /auth/login` - Login page
- `POST /auth/login` - User login (creates account if new user, triggers PDS indexing)
- `POST /auth/logout` - User logout

### Content Viewing

- `GET /posts` - List all posts from all registered users (paginated)
- `GET /posts/:did/:rkey` - View a specific post
- `GET /user/:handle` - View all posts from a specific user

### Content Creation (Authenticated)

- `GET /create` - Post creation form
- `POST /create` - Create a new post (writes to user's PDS)
- `GET /profile` - User profile with their posts
- `POST /refresh` - Re-index user's PDS on demand

## Lexicon Support

### Primary Record Types

**pub.leaflet.document**
- Main blog post record type
- Contains pages array (supporting linearDocument format)
- Metadata: title, description, author, publishedAt, tags

**pub.leaflet.publication** (optional for v1)
- Collection/blog container
- Contains name, description, theme

**pub.leaflet.pages.linearDocument**
- Linear document page format
- Contains blocks array with various block types

### Supported Block Types

Currently implemented block types:
- **text** - Plain text paragraphs with richtext facets (bold, italic, strikethrough, links, mentions)
- **header** - Headers (h1-h6)
- **blockquote** - Quoted text
- **image** - Images with captions (placeholder display, blob references)
- **horizontalRule** - Horizontal dividers
- **unorderedList** - Bulleted lists with nesting support
- **code** - Code blocks with optional language class
- **website** - Website link embeds with title/description
- **bskyPost** - Bluesky post embeds (links to bsky.app)

Not yet implemented:
- math, iframe (blocked for security), page, poll, button

### Richtext Facets

Leaflet uses `pub.leaflet.richtext.facet` for inline formatting:
- **#bold** - Bold text
- **#italic** - Italic text
- **#strikethrough** - Strikethrough text
- **#link** - Hyperlinks with URL
- **#mention** - User mentions with DID

Facets specify byte ranges in UTF-8 encoded text.

## Implementation Phases

### Phase 1: Core Infrastructure
1. Project setup with TypeScript, Express, SQLite
2. Database schema creation and migrations
3. Basic Express routes and middleware
4. Session management

### Phase 2: Authentication & PDS Indexing
1. Implement ATProto authentication flow
2. PDS indexer to fetch existing documents
3. Parse and store Leaflet documents in database
4. User signup flow with initial indexing

### Phase 3: Jetstream Integration
1. Set up Jetstream WebSocket client
2. Filter events by registered user DIDs
3. Process document create/update/delete events
4. Update local database in real-time

### Phase 4: Content Display
1. HTML renderer for linearDocument blocks
2. Post list page (all users' posts chronologically)
3. Individual post view page
4. User profile pages

### Phase 5: Content Creation
1. Post creation form
2. Convert form data to Leaflet document structure
3. Write document record to user's PDS via @atproto/api
4. Update local database

### Phase 6: Testing & Polish
1. End-to-end testing with test credentials
2. Error handling and validation
3. Basic styling for readability
4. Performance optimization

## Security Considerations

### Implemented

1. **Credential Storage**:
   - App passwords NEVER stored (used only for initial login)
   - ATProto session tokens (JWT) stored in database for session resumption
   - Session tokens cleared on logout

2. **Session Management**:
   - Secure HTTP-only cookies for application sessions
   - Random session tokens (cryptographically secure, 32 bytes)
   - Session expiration after 7 days or on logout
   - CSRF protection for all POST requests (token-based)

3. **Input Validation**:
   - DID format validation (`did:plc:` or `did:web:`)
   - Record key (rkey) format validation
   - URL validation (only http/https allowed)
   - Alignment value whitelist validation

4. **XSS Prevention**:
   - HTML escaping for all user content
   - URL validation rejects `javascript:` URLs
   - Alignment injection prevention via whitelist
   - Facet rendering with proper escaping

### Not Yet Implemented

5. **Rate Limiting** (future enhancement):
   - PDS query limits
   - Post creation limits

6. **Additional Headers** (future enhancement):
   - Content Security Policy headers
   - CORS configuration for API endpoints

7. **Enhanced Security** (future enhancement):
   - JWT encryption at rest
   - Session token hashing in database

## Jetstream Integration Details

### Connection

- WebSocket endpoint: `wss://jetstream2.us-east.bsky.network/subscribe`
- Query parameters: `wantedCollections=pub.leaflet.document,pub.leaflet.publication`
- Maintains persistent connection with auto-reconnect on disconnect
- Uses exponential backoff for reconnection attempts (1s, 2s, 4s, 8s, max 30s)

### Event Format

Jetstream sends JSON messages with this structure:
```json
{
  "did": "did:plc:xyz...",
  "time_us": 1234567890,
  "kind": "commit",
  "commit": {
    "rev": "abc123...",
    "operation": "create",
    "collection": "pub.leaflet.document",
    "rkey": "3k...",
    "record": { /* full record data */ },
    "cid": "bafyrei..."
  }
}
```

### Event Filtering

Only process events where:
- `did` is in the registered users table (checked via cached DID set)
- For commit events: `commit.collection` is `pub.leaflet.document` or `pub.leaflet.publication`
- For identity events: sync handle changes for registered users

### Event Operations

**Commit events:**
- **create** - New document/publication created → Insert into database
- **update** - Document/publication modified → Update existing database record
- **delete** - Document/publication deleted → Remove from database

**Identity events:**
- Handle change detected → Update user's handle in database

### Error Recovery

- Invalid/malformed events: Log and skip, continue processing
- Database errors: Log, alert, continue processing next event
- Connection loss: Auto-reconnect, resume from current position

## HTML Rendering Strategy

### Block Type Rendering

Map Leaflet blocks to semantic HTML:

```typescript
text -> <p> with inline richtext formatting
header -> <h1> to <h6> based on level
blockquote -> <blockquote>
image -> <figure><img><figcaption>
horizontalRule -> <hr>
unorderedList -> <ul><li>
```

### Page Layout

Minimalist design principles:
- Clean typography (system fonts)
- Readable line length (max 65-75 characters)
- Adequate spacing and whitespace
- Responsive layout
- No external dependencies (no CSS frameworks)

### Navigation

- Simple header with site title and navigation links
- Post metadata (author, date)
- Minimal footer

## Error Handling

1. **PDS Unreachable**: Log error, skip indexing, notify user
2. **Invalid Credentials**: Clear error message on login
3. **Jetstream Disconnection**: Auto-reconnect with exponential backoff
4. **Missing/Invalid Records**: Log and skip, don't crash
5. **Database Errors**: Transaction rollback, error logging

## Performance Considerations

1. **Pagination**: Limit posts per page (20-50)
2. **Database Indices**: Index on frequently queried fields
3. **Caching**: Cache rendered HTML for popular posts (future enhancement)
4. **Lazy Loading**: Only index users who sign up (not all of ATProto)
5. **Connection Pooling**: Reuse PDS connections where possible

## Development Environment

Required environment variables:
```
PORT=3000
DATABASE_PATH=./data/app.db
SESSION_SECRET=<random-secret>
JETSTREAM_URL=wss://jetstream2.us-east.bsky.network/subscribe

# Optional: for integration tests
TEST_HANDLE=your-handle.bsky.social
TEST_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

## Testing Strategy

Tests are implemented using Vitest with 81 total tests across 4 test files.

1. **Database Tests** (`src/database/index.test.ts`):
   - Schema validation, CRUD operations, cascade deletes, index verification

2. **Renderer Tests** (`src/services/renderer.test.ts`):
   - Block rendering, XSS prevention, facet formatting, alignment handling, URL validation

3. **Integration Tests** (`src/integration.test.ts`):
   - Real ATProto authentication, PDS document creation/retrieval, resync lifecycle

4. **Route Tests** (`src/routes/routes.test.ts`):
   - HTTP endpoints, authentication flow, CSRF protection, session handling

Run tests with:
- `npm test` - All tests
- `npm run test:unit` - Unit tests only (no credentials needed)
- `npm run test:integration` - Integration tests (requires TEST_HANDLE and TEST_APP_PASSWORD)

## Future Enhancements

1. Search functionality
2. Comments (using pub.leaflet.comment)
3. RSS feeds
4. Export to markdown/PDF
5. Publication management
6. Custom themes
7. Image upload support
8. Tag-based filtering
9. User following/discovery

## Dependencies

```json
{
  "dependencies": {
    "@atproto/api": "^0.14.x",
    "express": "^4.x",
    "better-sqlite3": "^11.x",
    "ws": "^8.x",
    "cookie-parser": "^1.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^22.x",
    "@types/express": "^5.x",
    "@types/better-sqlite3": "^7.x",
    "@types/ws": "^8.x",
    "@types/cookie-parser": "^1.x",
    "@types/supertest": "^6.x",
    "tsx": "^4.x",
    "vitest": "^4.x",
    "@vitest/coverage-v8": "^4.x",
    "supertest": "^7.x"
  }
}
```

## Lexicon

The Leaflet lexicon is implemented locally and types are defined for
it in src/types/leaflet.ts.

## Notes

- Start with SQLite for simplicity; can migrate to PostgreSQL if needed
- Focus on core functionality first; add features incrementally
- Prioritize data integrity and user privacy
- Keep the UI minimal and fast-loading
- Design for horizontal scalability (stateless app servers, shared database)
