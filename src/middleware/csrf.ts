import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Simple CSRF token store (in production, use session storage)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Generate a CSRF token for a session
export function generateCsrfToken(sessionToken: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 3600000; // 1 hour

  csrfTokens.set(sessionToken, { token, expires });

  // Clean up expired tokens periodically
  if (csrfTokens.size > 1000) {
    const now = Date.now();
    for (const [key, value] of csrfTokens) {
      if (value.expires < now) {
        csrfTokens.delete(key);
      }
    }
  }

  return token;
}

// Validate a CSRF token
export function validateCsrfToken(sessionToken: string, token: string): boolean {
  const stored = csrfTokens.get(sessionToken);
  if (!stored) return false;
  if (stored.expires < Date.now()) {
    csrfTokens.delete(sessionToken);
    return false;
  }
  return stored.token === token;
}

// Middleware to check CSRF token on POST requests
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF for non-authenticated routes
  if (req.method !== 'POST') {
    return next();
  }

  const sessionToken = req.cookies?.session;

  // Login doesn't require CSRF (no session yet)
  if (req.path === '/auth/login') {
    return next();
  }

  // For authenticated routes, validate CSRF token
  if (sessionToken) {
    const csrfToken = req.body?._csrf || req.headers['x-csrf-token'];

    if (!csrfToken || !validateCsrfToken(sessionToken, csrfToken as string)) {
      res.status(403).send('Invalid CSRF token');
      return;
    }
  }

  next();
}

// Helper to get or create CSRF token for templates
export function getCsrfToken(sessionToken: string | undefined): string {
  if (!sessionToken) return '';

  const stored = csrfTokens.get(sessionToken);
  if (stored && stored.expires > Date.now()) {
    return stored.token;
  }

  return generateCsrfToken(sessionToken);
}
