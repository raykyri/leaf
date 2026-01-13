import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Get the secret key for HMAC from environment or generate a default
// In production, SESSION_SECRET should always be set
const CSRF_SECRET = process.env.SESSION_SECRET || 'default-csrf-secret-change-me';

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
 * Middleware to check CSRF token on POST requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for non-POST requests
  if (req.method !== 'POST') {
    return next();
  }

  const sessionToken = req.cookies?.session;

  // Login/OAuth doesn't require CSRF (no session yet, or starting new auth flow)
  if (req.path === '/auth/login' || req.path === '/oauth/authorize') {
    return next();
  }

  // For authenticated routes, validate CSRF token
  if (sessionToken) {
    const csrfToken = req.body?._csrf || req.headers['x-csrf-token'];

    if (!csrfToken || typeof csrfToken !== 'string' || !validateCsrfToken(sessionToken, csrfToken)) {
      res.status(403).send('Invalid CSRF token');
      return;
    }
  }

  next();
}

/**
 * Get CSRF token for templates
 * Simply generates a new token (deterministic, so same result for same session/time)
 */
export function getCsrfToken(sessionToken: string | undefined): string {
  if (!sessionToken) return '';
  return generateCsrfToken(sessionToken);
}
