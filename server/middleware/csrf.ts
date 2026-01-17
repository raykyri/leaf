import type { Context, Next, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import crypto from 'crypto';

// Get the secret key for HMAC from environment
// SESSION_SECRET is required for secure CSRF token generation
const CSRF_SECRET = process.env.SESSION_SECRET;

if (!CSRF_SECRET || CSRF_SECRET.length < 32) {
  throw new Error(
    'SESSION_SECRET environment variable is required and must be at least 32 characters. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

// Token validity period in milliseconds (1 hour)
const TOKEN_VALIDITY_MS = 3600000;

// Time bucket size for token rotation (tokens valid across bucket boundaries)
const TIME_BUCKET_MS = TOKEN_VALIDITY_MS / 2; // 30 minutes

/**
 * Generate a deterministic CSRF token using HMAC
 * The token is based on the session token and a time bucket, making it:
 * - Deterministic (same inputs = same output)
 * - Time-limited (rotates every 30 minutes, valid for 1 hour)
 * - Cryptographically secure
 */
export function generateCsrfToken(sessionToken: string): string {
  if (!sessionToken) return '';

  const timeBucket = Math.floor(Date.now() / TIME_BUCKET_MS);
  const data = `${sessionToken}:${timeBucket}`;

  return crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(data)
    .digest('hex');
}

/**
 * Validate a CSRF token
 * Checks both current and previous time bucket to handle boundary conditions
 */
export function validateCsrfToken(sessionToken: string, token: string): boolean {
  if (!sessionToken || !token) return false;

  const currentTimeBucket = Math.floor(Date.now() / TIME_BUCKET_MS);

  // Check current time bucket
  const currentToken = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(`${sessionToken}:${currentTimeBucket}`)
    .digest('hex');

  // Use try/catch for timingSafeEqual as it throws if buffer lengths don't match
  try {
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(currentToken))) {
      return true;
    }
  } catch {
    // Buffer lengths don't match (invalid token format)
    return false;
  }

  // Check previous time bucket (for tokens generated near bucket boundary)
  const previousToken = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(`${sessionToken}:${currentTimeBucket - 1}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(previousToken));
  } catch {
    // Buffer lengths don't match (invalid token format)
    return false;
  }
}

/**
 * Middleware to check CSRF token on state-changing requests
 * Protects POST, PUT, PATCH, and DELETE requests
 */
export const csrfProtection: MiddlewareHandler = async (c: Context, next: Next) => {
  // Only check state-changing methods
  const method = c.req.method;
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
    return next();
  }

  const sessionToken = getCookie(c, 'session');
  const path = new URL(c.req.url).pathname;

  // Login/OAuth doesn't require CSRF (no session yet, or starting new auth flow)
  if (path === '/auth/login' || path === '/api/auth/login' || path === '/oauth/authorize') {
    return next();
  }

  // For authenticated routes, validate CSRF token
  if (sessionToken) {
    // Try to get CSRF token from body or header
    let csrfToken: string | undefined;

    // Check header first (preferred for API requests)
    csrfToken = c.req.header('x-csrf-token');

    // If not in header, check body
    if (!csrfToken) {
      try {
        const contentType = c.req.header('content-type') || '';
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const body = await c.req.parseBody();
          csrfToken = body._csrf as string | undefined;
        } else if (contentType.includes('application/json')) {
          // Clone the request to read the body without consuming it
          const clonedReq = c.req.raw.clone();
          const body = await clonedReq.json();
          csrfToken = body._csrf;
        }
      } catch {
        // Body parsing failed, csrfToken remains undefined
      }
    }

    if (!csrfToken || typeof csrfToken !== 'string' || !validateCsrfToken(sessionToken, csrfToken)) {
      // Return JSON error for API routes, text for others
      if (path.startsWith('/api/')) {
        return c.json({ error: 'Invalid CSRF token' }, 403);
      }
      return c.text('Invalid CSRF token', 403);
    }
  }

  await next();
};

/**
 * Get CSRF token for templates
 * Simply generates a new token (deterministic, so same result for same session/time)
 */
export function getCsrfToken(sessionToken: string | undefined): string {
  if (!sessionToken) return '';
  return generateCsrfToken(sessionToken);
}
