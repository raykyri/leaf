import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getCookie } from 'hono/cookie';
import { getDatabase, closeDatabase, deleteExpiredSessions, cleanupOldOAuthState, cleanupOldOAuthSessions } from './database/index.ts';
import { startJetstreamListener, stopJetstreamListener } from './services/jetstream.ts';
import { csrfProtection, getCsrfToken } from './middleware/csrf.ts';
import { generalLimiter } from './middleware/rateLimit.ts';
import { securityHeaders } from './middleware/securityHeaders.ts';
import authRoutes from './routes/auth.ts';
import oauthRoutes from './routes/oauth.ts';
import apiRoutes from './routes/api.ts';
import { getSessionUser } from './services/auth.ts';
import { isOAuthConfigured } from './services/oauth-client.ts';
import { initializePds, createPdsRoutes, isPdsEnabled, getPdsConfig } from './pds/index.ts';
import fs from 'fs';
import path from 'path';

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is not set.');
  console.error('Please set SESSION_SECRET to a secure random string (at least 32 characters).');
  console.error('You can generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

if (process.env.SESSION_SECRET.length < 32) {
  console.error('FATAL: SESSION_SECRET must be at least 32 characters long for security.');
  process.exit(1);
}

const app = new Hono();
const PORT = parseInt(process.env.PORT || '3334', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use('*', securityHeaders);
app.use('*', generalLimiter);
app.use('*', csrfProtection);

// Serve static files from server/public (for server-rendered pages like canvas editor)
app.use('/js/*', serveStatic({ root: './server/public' }));

// Health check endpoint
app.get('/healthz', (c) => {
  return c.text('ok', 200);
});

// Initialize database
console.log('Initializing database...');
getDatabase();

// Initialize PDS if configured
if (isPdsEnabled()) {
  console.log('Initializing PDS...');
  initializePds();
}

// Clean up expired sessions and old OAuth state on startup
deleteExpiredSessions();
cleanupOldOAuthState();
cleanupOldOAuthSessions();

// API routes (JSON endpoints for React frontend)
app.route('/api', apiRoutes);

// Auth routes (HTML form-based, for backward compatibility)
app.route('/auth', authRoutes);
app.route('/oauth', oauthRoutes);

// PDS routes (ATProto endpoints for social login users)
if (isPdsEnabled()) {
  const pdsRoutes = createPdsRoutes();
  app.route('/', pdsRoutes);
}

// In production, serve static files from dist/client
if (isProduction) {
  // Serve static assets
  app.use('/assets/*', serveStatic({ root: './dist/client' }));

  // Serve any static files that exist
  app.use('*', async (c, next) => {
    const reqPath = c.req.path;
    // Skip API and auth routes
    if (reqPath.startsWith('/api/') || reqPath.startsWith('/auth/') || reqPath.startsWith('/oauth/')) {
      return next();
    }

    // Check if the path is a static file (has extension)
    if (/\.[a-zA-Z0-9]+$/.test(reqPath)) {
      const filePath = path.join(process.cwd(), 'dist/client', reqPath);
      if (fs.existsSync(filePath)) {
        return serveStatic({ root: './dist/client' })(c, next);
      }
    }

    return next();
  });

  // SPA fallback: serve index.html for all non-API routes
  app.get('*', async (c) => {
    const reqPath = c.req.path;
    // Skip API and auth routes
    if (reqPath.startsWith('/api/') || reqPath.startsWith('/auth/') || reqPath.startsWith('/oauth/')) {
      return c.text('Not Found', 404);
    }

    const indexPath = path.join(process.cwd(), 'dist/client/index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf-8');
      return c.html(html);
    }

    return c.text('Not Found', 404);
  });
} else {
  // Development: only API routes are handled, Vite dev server handles frontend
  // Redirect root to Vite dev server (running on port 3333)
  app.get('/', (c) => {
    const sessionToken = getCookie(c, 'session');
    if (sessionToken) {
      const auth = getSessionUser(sessionToken);
      if (auth) {
        // User is logged in, they should use the React app
        return c.text('Please access the app at http://localhost:3333', 200);
      }
    }
    return c.text('Please access the app at http://localhost:3333', 200);
  });
}

// 404 handler for API routes
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404);
  }

  // In production, serve index.html for SPA routing
  if (isProduction) {
    const indexPath = path.join(process.cwd(), 'dist/client/index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf-8');
      return c.html(html);
    }
  }

  return c.text('Not Found', 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Internal Server Error' }, 500);
  }

  return c.text('Internal Server Error', 500);
});

// Start server
const server = serve({
  fetch: app.fetch,
  port: PORT
}, () => {
  console.log(`Server running at http://localhost:${PORT}`);

  if (!isProduction) {
    console.log(`Frontend dev server at http://localhost:3333`);
  }

  // Warn if OAuth is not configured
  if (!isOAuthConfigured()) {
    const cyan = '\x1b[36m';
    const reset = '\x1b[0m';
    console.log('');
    console.log(`${cyan}OAuth is not configured, so only app password login is available.${reset}`);
    console.log(`${cyan}To enable OAuth login, set PUBLIC_URL to your app's public URL.${reset}`);
    console.log(`${cyan}  PUBLIC_URL=https://yourdomain.com${reset}`)
    console.log(`${cyan}  PUBLIC_URL=http://localhost:3333${reset}`)
    console.log('');
  }

  // Show PDS status
  if (isPdsEnabled()) {
    const green = '\x1b[32m';
    const reset = '\x1b[0m';
    const config = getPdsConfig();
    console.log('');
    console.log(`${green}PDS (Personal Data Server) is enabled${reset}`);
    console.log(`${green}  Handle domain: ${config.handleDomain}${reset}`);
    console.log(`${green}  Social login providers:${reset}`);
    if (config.github) console.log(`${green}    - GitHub${reset}`);
    if (config.google) console.log(`${green}    - Google${reset}`);
    console.log('');
  } else {
    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    console.log('');
    console.log(`${yellow}PDS is not enabled. To enable social login:${reset}`);
    console.log(`${yellow}  Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET for GitHub login${reset}`);
    console.log(`${yellow}  Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Google login${reset}`);
    console.log('');
  }

  // Start Jetstream listener
  console.log('Starting Jetstream listener...');
  startJetstreamListener();
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');

  stopJetstreamListener();

  server.close(() => {
    console.log('HTTP server closed');
    closeDatabase();
    console.log('Database closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcing exit');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
