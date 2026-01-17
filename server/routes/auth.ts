import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { authenticateUser, logout } from '../services/auth.ts';
import { indexUserPDS } from '../services/indexer.ts';
import { loginPage } from '../views/pages.ts';
import { authLimiter } from '../middleware/rateLimit.ts';
import * as db from '../database/index.ts';

const auth = new Hono();

const isProduction = process.env.NODE_ENV === 'production';

// Login page
auth.get('/login', (c) => {
  // If already logged in, redirect to profile
  const sessionToken = getCookie(c, 'session');
  if (sessionToken) {
    const session = db.getSessionByToken(sessionToken);
    if (session) {
      return c.redirect('/profile');
    }
  }

  return c.html(loginPage());
});

// Handle login (with rate limiting to prevent brute force)
auth.post('/login', authLimiter, async (c) => {
  const body = await c.req.parseBody();
  const handle = body.handle as string | undefined;
  const password = body.password as string | undefined;

  if (!handle || !password) {
    return c.html(loginPage('Please provide both handle and password'));
  }

  const result = await authenticateUser(handle, password);

  if (!result.success || !result.user || !result.session) {
    return c.html(loginPage(result.error || 'Authentication failed'));
  }

  // Check if this is a new user (needs indexing)
  const isNewUser = !result.user.last_indexed_at;

  // Set session cookie with security flags
  setCookie(c, 'session', result.session.session_token, {
    httpOnly: true,
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    sameSite: 'Strict'
  });

  // If new user, index their PDS
  if (isNewUser) {
    try {
      console.log(`New user ${result.user.handle}, indexing PDS...`);
      await indexUserPDS(result.user);
    } catch (error) {
      console.error('Error indexing new user PDS:', error);
      // Continue anyway, they can manually refresh later
    }
  }

  return c.redirect('/profile');
});

// Handle logout
auth.post('/logout', async (c) => {
  const sessionToken = getCookie(c, 'session');
  if (sessionToken) {
    await logout(sessionToken);
  }

  // Clear cookie with same options for proper deletion
  deleteCookie(c, 'session', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'Strict'
  });
  return c.redirect('/');
});

export default auth;
