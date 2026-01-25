/**
 * Leaf PDS (Personal Data Server)
 *
 * Main entry point for the PDS functionality.
 * Provides ATProto-compatible endpoints for users who sign in via social login.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { getDatabase } from '../database/index.ts';
import { initializePdsSchema } from './database/schema.ts';
import { getPdsConfig, isPdsEnabled } from './config.ts';
import { createXrpcRouter } from './xrpc/server.ts';
import {
  getGitHubAuthorizationUrl,
  handleGitHubCallback,
  generateHandleFromGitHub,
} from './auth/github.ts';
import {
  getGoogleAuthorizationUrl,
  handleGoogleCallback,
  generateHandleFromGoogle,
} from './auth/google.ts';
import { createAccountHandler } from './xrpc/handlers/server.ts';
import { serveAtprotoDid } from './xrpc/handlers/identity.ts';
import { createFirehoseServer, handleFirehoseConnection } from './sync/firehose.ts';
import { cleanupExpiredSessions } from './auth/session.ts';
import { SESSION_EXPIRY_MS } from '../utils/constants.ts';

/**
 * Build a secure session cookie string
 */
function buildSessionCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 60 * 60 * 24 * 7; // 7 days

  let cookie = `pds_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;

  // Add Secure flag in production (requires HTTPS)
  if (isProduction) {
    cookie += '; Secure';
  }

  return cookie;
}

/**
 * Initialize the PDS database schema
 */
export function initializePds(): void {
  const db = getDatabase();
  initializePdsSchema(db);
  console.log('PDS database schema initialized');

  // Start periodic cleanup of expired sessions
  setInterval(() => {
    cleanupExpiredSessions();
  }, SESSION_EXPIRY_MS / 2);
}

/**
 * Create the PDS routes
 */
export function createPdsRoutes(): Hono {
  const app = new Hono();

  // ============================================
  // Social Login Routes
  // ============================================

  // GitHub OAuth
  app.get('/pds/auth/github', (c: Context) => {
    const config = getPdsConfig();
    if (!config.github) {
      return c.json({ error: 'GitHub login not configured' }, 400);
    }

    const { url } = getGitHubAuthorizationUrl();
    return c.redirect(url);
  });

  app.get('/pds/auth/github/callback', async (c: Context) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      return c.redirect(`/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.redirect('/login?error=missing_params');
    }

    try {
      const user = await handleGitHubCallback(code, state);
      const config = getPdsConfig();

      // Create or get account
      const result = await createAccountHandler(
        'github',
        user.id.toString(),
        user.email!,
        generateHandleFromGitHub(user.login, config.handleDomain)
      );

      // Set session cookie with Secure flag in production
      c.header('Set-Cookie', buildSessionCookie(result.accessJwt));

      // Redirect to profile
      return c.redirect('/profile');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('GitHub callback error:', message);
      return c.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  });

  // Google OAuth
  app.get('/pds/auth/google', (c: Context) => {
    const config = getPdsConfig();
    if (!config.google) {
      return c.json({ error: 'Google login not configured' }, 400);
    }

    const { url } = getGoogleAuthorizationUrl();
    return c.redirect(url);
  });

  app.get('/pds/auth/google/callback', async (c: Context) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      return c.redirect(`/login?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.redirect('/login?error=missing_params');
    }

    try {
      const user = await handleGoogleCallback(code, state);
      const config = getPdsConfig();

      // Create or get account
      const result = await createAccountHandler(
        'google',
        user.id,
        user.email,
        generateHandleFromGoogle(user, config.handleDomain)
      );

      // Set session cookie with Secure flag in production
      c.header('Set-Cookie', buildSessionCookie(result.accessJwt));

      // Redirect to profile
      return c.redirect('/profile');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      console.error('Google callback error:', message);
      return c.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  });

  // ============================================
  // .well-known endpoints
  // ============================================

  app.get('/.well-known/atproto-did', serveAtprotoDid);

  // ============================================
  // XRPC endpoints
  // ============================================

  const xrpcRouter = createXrpcRouter();
  app.route('/', xrpcRouter);

  // ============================================
  // Status endpoint
  // ============================================

  app.get('/pds/status', (c: Context) => {
    const config = getPdsConfig();
    return c.json({
      status: 'ok',
      hostname: config.hostname,
      handleDomain: config.handleDomain,
      socialProviders: {
        github: config.github !== null,
        google: config.google !== null,
      },
    });
  });

  return app;
}

/**
 * Get WebSocket upgrade handler for firehose
 */
export function getFirehoseUpgradeHandler() {
  return (request: Request, socket: any, head: Buffer) => {
    const url = new URL(request.url, 'http://localhost');

    if (url.pathname === '/xrpc/com.atproto.sync.subscribeRepos') {
      const cursorParam = url.searchParams.get('cursor');
      const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;

      // WebSocket upgrade would happen here
      // For now, this is a placeholder - actual implementation depends on server setup
      console.log('Firehose connection requested, cursor:', cursor);
    }
  };
}

/**
 * Check if PDS is enabled
 */
export { isPdsEnabled };

/**
 * Get PDS configuration
 */
export { getPdsConfig };
