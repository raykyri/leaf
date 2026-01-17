import type { MiddlewareHandler } from 'hono';

/**
 * Security headers middleware
 * Adds common security headers to all responses
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  // Prevent MIME type sniffing
  c.header('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  c.header('X-Frame-Options', 'DENY');

  // Legacy XSS protection for older browsers
  c.header('X-XSS-Protection', '1; mode=block');

  // Control referrer information
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Prevent browsers from caching sensitive responses
  // Only apply to API routes and authenticated pages
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api/') || path === '/profile' || path === '/create') {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.header('Pragma', 'no-cache');
  }

  // Content Security Policy
  // Note: Inline scripts for theme initialization still require 'unsafe-inline'
  // The canvas editor has been extracted to /js/canvas-editor.js
  // TODO: Consider nonce-based CSP or extracting theme scripts for stricter policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // unsafe-inline needed for theme initialization
    "style-src 'self' 'unsafe-inline'",  // unsafe-inline needed for inline styles
    "img-src 'self' https: data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://bsky.social https://*.bsky.network wss://*.bsky.network",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  c.header('Content-Security-Policy', csp);
};
