import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { getCookie } from 'hono/cookie';
import { getDatabase, closeDatabase, deleteExpiredSessions, cleanupOldOAuthState, cleanupOldOAuthSessions } from './database/index.ts';
import { startJetstreamListener, stopJetstreamListener } from './services/jetstream.ts';
import { csrfProtection, getCsrfToken } from './middleware/csrf.ts';
import { generalLimiter } from './middleware/rateLimit.ts';
import authRoutes from './routes/auth.ts';
import postsRoutes from './routes/posts.ts';
import oauthRoutes from './routes/oauth.ts';
import canvasesRoutes from './routes/canvases.ts';
import { loginPage, notFoundPage, errorPage } from './views/pages.ts';
import { getSessionUser } from './services/auth.ts';
import { isOAuthConfigured } from './services/oauth-client.ts';

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
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use('*', generalLimiter);
app.use('*', csrfProtection);

// Health check endpoint (no rate limiting, no CSRF - handled before middleware)
app.get('/healthz', (c) => {
  return c.text('ok', 200);
});

// Initialize database
console.log('Initializing database...');
getDatabase();

// Clean up expired sessions and old OAuth state on startup
deleteExpiredSessions();
cleanupOldOAuthState();
cleanupOldOAuthSessions();

// Routes
app.route('/auth', authRoutes);
app.route('/oauth', oauthRoutes);
app.route('/', canvasesRoutes);
app.route('/', postsRoutes);

// Home page
app.get('/', (c) => {
  const sessionToken = getCookie(c, 'session');
  if (sessionToken) {
    const auth = getSessionUser(sessionToken);
    if (auth) {
      return c.redirect('/profile');
    }
  }

  // Show login page for unauthenticated users
  return c.html(loginPage());
});

// 404 handler
app.notFound((c) => {
  const sessionToken = getCookie(c, 'session');
  let user: { handle: string; csrfToken?: string } | undefined;

  if (sessionToken) {
    const auth = getSessionUser(sessionToken);
    if (auth) {
      user = { handle: auth.user.handle, csrfToken: getCsrfToken(sessionToken) };
    }
  }

  return c.html(notFoundPage(user), 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  const sessionToken = getCookie(c, 'session');
  let user: { handle: string; csrfToken?: string } | undefined;

  if (sessionToken) {
    const auth = getSessionUser(sessionToken);
    if (auth) {
      user = { handle: auth.user.handle, csrfToken: getCsrfToken(sessionToken) };
    }
  }

  return c.html(errorPage(user), 500);
});

// Start server
const server = serve({
  fetch: app.fetch,
  port: PORT
}, () => {
  console.log(`Server running at http://localhost:${PORT}`);

  // Warn if OAuth is not configured
  if (!isOAuthConfigured()) {
    const cyan = '\x1b[36m';
    const reset = '\x1b[0m';
    console.log('');
    console.log(`${cyan}OAuth is not configured, so only app password login is available.${reset}`);
    console.log(`${cyan}To enable OAuth login, set PUBLIC_URL to your app's public URL.${reset}`);
    console.log(`${cyan}  PUBLIC_URL=https://yourdomain.com${reset}`)
    console.log(`${cyan}  PUBLIC_URL=http://localhost:3000${reset}`)
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
