import type { Context, Next, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';

interface RateLimitStore {
  hits: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
}

// In-memory store for rate limiting
const stores = new Map<string, Map<string, RateLimitStore>>();

function createRateLimiter(name: string, options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, message } = options;

  // Initialize store for this limiter
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of store.entries()) {
      if (now > data.resetTime) {
        store.delete(key);
      }
    }
  }, windowMs);

  return async (c: Context, next: Next) => {
    // Get client IP
    let ip: string;
    try {
      const connInfo = getConnInfo(c);
      ip = connInfo?.remote?.address || 'unknown';
    } catch {
      ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    }

    const now = Date.now();
    const record = store.get(ip);

    if (!record || now > record.resetTime) {
      // Start new window
      store.set(ip, { hits: 1, resetTime: now + windowMs });
    } else {
      // Increment hits in current window
      record.hits++;

      if (record.hits > max) {
        // Set rate limit headers
        c.header('X-RateLimit-Limit', max.toString());
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
        c.header('Retry-After', Math.ceil((record.resetTime - now) / 1000).toString());

        return c.text(message, 429);
      }
    }

    // Set rate limit headers for successful requests
    const currentRecord = store.get(ip)!;
    c.header('X-RateLimit-Limit', max.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, max - currentRecord.hits).toString());
    c.header('X-RateLimit-Reset', Math.ceil(currentRecord.resetTime / 1000).toString());

    await next();
  };
}

// Rate limiter for authentication endpoints (login)
// Strict limits to prevent brute force attacks
export const authLimiter = createRateLimiter('auth', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

// Rate limiter for post creation
// More lenient but still prevents spam
export const createPostLimiter = createRateLimiter('createPost', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 posts per hour per IP
  message: 'Too many posts created. Please try again later.'
});

// Rate limiter for post updates
export const updatePostLimiter = createRateLimiter('updatePost', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // 60 updates per hour per IP
  message: 'Too many post updates. Please try again later.'
});

// Rate limiter for canvas updates
export const updateCanvasLimiter = createRateLimiter('updateCanvas', {
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 updates per minute (autosave-friendly)
  message: 'Too many canvas updates. Please try again later.'
});

// Rate limiter for delete operations
export const deleteLimiter = createRateLimiter('delete', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 deletes per hour per IP
  message: 'Too many delete operations. Please try again later.'
});

// Rate limiter for profile updates
export const updateProfileLimiter = createRateLimiter('updateProfile', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 profile updates per hour per IP
  message: 'Too many profile updates. Please try again later.'
});

// General API rate limiter
// Prevents excessive requests to any endpoint
export const generalLimiter = createRateLimiter('general', {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests. Please slow down.'
});
