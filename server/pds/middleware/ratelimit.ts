/**
 * Rate Limiting Middleware
 *
 * Simple in-memory rate limiter for PDS endpoints.
 * For production, consider using Redis for distributed rate limiting.
 */

import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  // Maximum requests per window
  maxRequests: number;
  // Window size in milliseconds
  windowMs: number;
  // Key extractor function (default: IP address)
  keyExtractor?: (c: Context) => string;
  // Skip rate limiting for certain requests
  skip?: (c: Context) => boolean;
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // Every minute

/**
 * Extract client IP from request
 */
function getClientIp(c: Context): string {
  // Check common proxy headers
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection info (implementation-dependent)
  return 'unknown';
}

/**
 * Create a rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const { maxRequests, windowMs, keyExtractor, skip } = config;

  return async (c: Context, next: Next) => {
    // Check if we should skip rate limiting
    if (skip && skip(c)) {
      return next();
    }

    // Get the rate limit key
    const key = keyExtractor ? keyExtractor(c) : getClientIp(c);
    const now = Date.now();

    // Get or create entry
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new window
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    // Increment count
    entry.count++;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    // Check if rate limited
    if (entry.count > maxRequests) {
      c.header('Retry-After', Math.ceil((entry.resetAt - now) / 1000).toString());
      return c.json(
        {
          error: 'RateLimitExceeded',
          message: 'Too many requests. Please try again later.',
        },
        429
      );
    }

    return next();
  };
}

/**
 * Default rate limit configurations for different endpoint types
 */
export const rateLimits = {
  // Standard API endpoints: 100 requests per minute
  standard: rateLimit({
    maxRequests: 100,
    windowMs: 60 * 1000,
  }),

  // Write operations: 30 requests per minute
  write: rateLimit({
    maxRequests: 30,
    windowMs: 60 * 1000,
  }),

  // Authentication endpoints: 10 requests per minute (stricter to prevent brute force)
  auth: rateLimit({
    maxRequests: 10,
    windowMs: 60 * 1000,
  }),

  // Blob uploads: 20 requests per minute
  upload: rateLimit({
    maxRequests: 20,
    windowMs: 60 * 1000,
  }),

  // Read-heavy endpoints: 300 requests per minute
  read: rateLimit({
    maxRequests: 300,
    windowMs: 60 * 1000,
  }),
};

/**
 * Create a rate limiter with custom configuration
 */
export function createRateLimiter(maxRequests: number, windowMs: number): ReturnType<typeof rateLimit> {
  return rateLimit({ maxRequests, windowMs });
}
