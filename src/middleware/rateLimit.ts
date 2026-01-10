import rateLimit from 'express-rate-limit';

// Rate limiter for authentication endpoints (login)
// Strict limits to prevent brute force attacks
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: 'Too many login attempts. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Rate limiter for post creation
// More lenient but still prevents spam
export const createPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 posts per hour per IP
  message: 'Too many posts created. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// General API rate limiter
// Prevents excessive requests to any endpoint
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: 'Too many requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false
});
