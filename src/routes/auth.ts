import { Router, Request, Response } from 'express';
import { authenticateUser, logout } from '../services/auth.js';
import { indexUserPDS } from '../services/indexer.js';
import { loginPage } from '../views/pages.js';
import { authLimiter } from '../middleware/rateLimit.js';
import * as db from '../database/index.js';

const router = Router();

const isProduction = process.env.NODE_ENV === 'production';

// Login page
router.get('/login', (req: Request, res: Response) => {
  // If already logged in, redirect to profile
  const sessionToken = req.cookies?.session;
  if (sessionToken) {
    const session = db.getSessionByToken(sessionToken);
    if (session) {
      res.redirect('/profile');
      return;
    }
  }

  res.send(loginPage());
});

// Handle login (with rate limiting to prevent brute force)
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const { handle, password } = req.body;

  if (!handle || !password) {
    res.send(loginPage('Please provide both handle and password'));
    return;
  }

  const result = await authenticateUser(handle, password);

  if (!result.success || !result.user || !result.session) {
    res.send(loginPage(result.error || 'Authentication failed'));
    return;
  }

  // Check if this is a new user (needs indexing)
  const isNewUser = !result.user.last_indexed_at;

  // Set session cookie with security flags
  res.cookie('session', result.session.session_token, {
    httpOnly: true,
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax'
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

  res.redirect('/profile');
});

// Handle logout
router.post('/logout', async (req: Request, res: Response) => {
  const sessionToken = req.cookies?.session;
  if (sessionToken) {
    await logout(sessionToken);
  }

  // Clear cookie with same options for proper deletion
  res.clearCookie('session', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax'
  });
  res.redirect('/');
});

export default router;
