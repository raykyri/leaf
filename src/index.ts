import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { getDatabase, closeDatabase, deleteExpiredSessions } from './database/index.js';
import { startJetstreamListener, stopJetstreamListener } from './services/jetstream.js';
import { csrfProtection, getCsrfToken } from './middleware/csrf.js';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import { loginPage, notFoundPage, errorPage } from './views/pages.js';
import { getSessionUser } from './services/auth.js';

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

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);

// Initialize database
console.log('Initializing database...');
getDatabase();

// Clean up expired sessions on startup
deleteExpiredSessions();

// Routes
app.use('/auth', authRoutes);
app.use('/', postsRoutes);

// Home page
app.get('/', (req, res) => {
  const sessionToken = req.cookies?.session;
  if (sessionToken) {
    const auth = getSessionUser(sessionToken);
    if (auth) {
      res.redirect('/profile');
      return;
    }
  }

  // Show login page for unauthenticated users
  res.send(loginPage());
});

// 404 handler
app.use((req, res) => {
  const sessionToken = req.cookies?.session;
  let user: { handle: string; csrfToken?: string } | undefined;

  if (sessionToken) {
    const auth = getSessionUser(sessionToken);
    if (auth) {
      user = { handle: auth.user.handle, csrfToken: getCsrfToken(sessionToken) };
    }
  }

  res.status(404).send(notFoundPage(user));
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);

  const sessionToken = req.cookies?.session;
  let user: { handle: string; csrfToken?: string } | undefined;

  if (sessionToken) {
    const auth = getSessionUser(sessionToken);
    if (auth) {
      user = { handle: auth.user.handle, csrfToken: getCsrfToken(sessionToken) };
    }
  }

  res.status(500).send(errorPage(user));
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);

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
