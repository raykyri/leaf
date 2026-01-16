# Leaf

A minimalist blogging platform built on the [AT Protocol](https://atproto.com) using the [Leaflet](https://leaflet.pub) lexicon for rich document publishing.

## Features

- **ATProto OAuth Login**: Sign in securely using your Bluesky account (recommended)
- **App Password Support**: Alternative sign-in using app passwords
- **PDS Integration**: Indexes your existing Leaflet documents from your Personal Data Server
- **Real-time Updates**: Listens to Jetstream for live updates from registered users
- **Create Posts**: Write new posts that get stored on your PDS
- **Minimalist UI**: Clean, server-rendered HTML pages

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/raykyri/leaf.git
cd leaf

npm install

# Copy environment file and configure
cp .env.example .env
```

### Configuration

Edit `.env` with your settings:

```env
PORT=3333
DATABASE_PATH=./data/app.db
SESSION_SECRET=your-random-secret-key-change-this
JETSTREAM_URL=wss://jetstream2.us-east.bsky.network/subscribe

# OAuth Configuration (required for OAuth login)
PUBLIC_URL=https://yourdomain.com

# Optional: Test credentials for integration tests
TEST_HANDLE=your-handle.bsky.social
TEST_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

### Setting Up OAuth (Recommended)

ATProto OAuth provides a secure way for users to authenticate without sharing their app passwords. To enable OAuth:

1. **Set the PUBLIC_URL**: Set this to your application's URL.
   ```env
   # For local development
   PUBLIC_URL=http://localhost:3333

   # For production
   PUBLIC_URL=https://yourdomain.com
   ```

2. **Deploy your app**: The OAuth client metadata is served at `/oauth/client-metadata.json`. ATProto authorization servers will fetch this to verify your client.

**Note**: If `PUBLIC_URL` is not set, OAuth will be disabled and only app password login will be available.

#### Local Development with OAuth

OAuth works in local development using loopback addresses. You can use:
- `http://localhost:PORT` (e.g., `http://localhost:3333`)
- `http://127.0.0.1:PORT` (e.g., `http://127.0.0.1:3333`)

The app automatically configures the OAuth client metadata according to the ATProto spec for loopback clients.

To test OAuth locally:
```bash
# Set PUBLIC_URL in your .env (either localhost or 127.0.0.1 works)
echo "PUBLIC_URL=http://localhost:3333" >> .env

# Start the dev server
npm run dev
```

Then visit your configured URL and use "Sign in with Bluesky".

#### Production Deployment

For production, use HTTPS:
```env
PUBLIC_URL=https://yourdomain.com
```

Ensure your server is accessible at this URL so authorization servers can fetch the client metadata.

### Running the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

The application will be available at `http://localhost:3333`.

## Usage

1. **Sign In**: You have two authentication options:
   - **OAuth (Recommended)**: Enter your Bluesky handle and click "Sign in with Bluesky". You'll be redirected to authorize the app.
   - **App Password**: Enter your handle and an app password. Create one at [bsky.app/settings/app-passwords](https://bsky.app/settings/app-passwords)

2. **View Posts**: Browse all posts from registered users at `/posts`

3. **Create Posts**: Click "New Post" to create a Leaflet document that gets stored on your PDS

4. **Refresh**: Click "Refresh from PDS" on your profile to re-index your documents

## Project Structure

```
src/
  database/           # SQLite database operations
    schema.ts         # Table definitions
    index.ts          # CRUD operations
  services/
    auth.ts           # ATProto authentication
    oauth-client.ts   # ATProto OAuth client
    indexer.ts        # PDS document indexing
    jetstream.ts      # Real-time Jetstream listener
    renderer.ts       # Leaflet blocks to HTML
    posts.ts          # Post creation
  middleware/
    csrf.ts           # CSRF protection
  routes/
    auth.ts           # Login/logout routes
    oauth.ts          # OAuth routes
    posts.ts          # Post viewing and creation routes
  views/
    layout.ts         # HTML layout template
    pages.ts          # Page templates
  types/
    leaflet.ts        # TypeScript types for Leaflet lexicon
  index.ts            # Application entry point
```

## Testing

The project includes comprehensive unit and integration tests using [Vitest](https://vitest.dev/).

### Running Tests

```bash
# Run all tests (unit tests run without credentials)
npm test

# Run unit tests only
npm run test:unit

# Run integration tests (requires TEST_HANDLE and TEST_APP_PASSWORD)
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Categories

1. **Database Tests** (`src/database/index.test.ts`)
   - Schema validation
   - CRUD operations
   - Cascade deletes
   - Index verification

2. **Renderer Tests** (`src/services/renderer.test.ts`)
   - Block rendering (text, headers, lists, code, etc.)
   - XSS prevention
   - Facets/rich text formatting
   - Alignment handling
   - URL validation

3. **Integration Tests** (`src/integration.test.ts`)
   - Real ATProto authentication
   - Creating documents on PDS
   - Indexing/resyncing from PDS
   - Document updates and deletion
   - Pagination

4. **Route Tests** (`src/routes/routes.test.ts`)
   - Public routes (login page, post listing)
   - Protected routes (profile, create post)
   - CSRF protection
   - Session handling

### Integration Test Requirements

Integration tests require real ATProto credentials. Set these in `.env`:

```env
TEST_HANDLE=raymond.bsky.social
TEST_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Tests will be skipped if credentials are not provided.

## API Routes

### Public Routes
- `GET /` - Home/login page
- `GET /posts` - List all posts (paginated)
- `GET /posts/:did/:rkey` - View a specific post
- `GET /user/:handle` - View posts by a user

### Authentication
- `GET /auth/login` - Login page
- `POST /auth/login` - Handle login (app password)
- `POST /auth/logout` - Handle logout

### OAuth Routes
- `GET /oauth/client-metadata.json` - OAuth client metadata
- `POST /oauth/authorize` - Initiate OAuth flow
- `GET /oauth/callback` - OAuth callback handler

### Authenticated Routes
- `GET /profile` - User's posts and settings
- `GET /create` - Post creation form
- `POST /create` - Create a new post
- `POST /refresh` - Re-index from PDS

## Security Features

- **CSRF Protection**: All POST requests require valid CSRF tokens
- **XSS Prevention**: All user content is HTML-escaped
- **Secure Cookies**: HTTP-only, SameSite=Lax session cookies
- **Input Validation**: DID and rkey format validation
- **URL Validation**: Only http/https URLs allowed in links

## Supported Leaflet Block Types

- Text paragraphs with rich text (bold, italic, strikethrough, links, mentions)
- Headers (h1-h6)
- Blockquotes
- Horizontal rules
- Unordered lists (with nesting)
- Code blocks (with language highlighting class)
- Images (placeholder display)
- Website embeds
- Bluesky post embeds

## Development

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm start            # Run production build
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3333` |
| `DATABASE_PATH` | SQLite database path | `./data/app.db` |
| `SESSION_SECRET` | Secret for session tokens | (required) |
| `PUBLIC_URL` | Public URL for OAuth (e.g., `https://yourdomain.com`) | (optional, enables OAuth) |
| `JETSTREAM_URL` | Jetstream WebSocket URL | `wss://jetstream2.us-east.bsky.network/subscribe` |
| `TEST_HANDLE` | Test account handle | (optional) |
| `TEST_APP_PASSWORD` | Test account app password | (optional) |

## License

[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)
