import { Router, Request, Response } from 'express';
import {
  getClientMetadataJson,
  initiateOAuth,
  handleOAuthCallback,
  isOAuthConfigured,
} from '../services/oauth-client.js';
import { indexUserPDS } from '../services/indexer.js';
import { loginPage } from '../views/pages.js';
import { authLimiter } from '../middleware/rateLimit.js';
import * as db from '../database/index.js';

const router = Router();

const isProduction = process.env.NODE_ENV === 'production';

// Serve OAuth client metadata (required for ATProto OAuth)
router.get('/client-metadata.json', (_req: Request, res: Response) => {
  if (!isOAuthConfigured()) {
    res.status(404).json({ error: 'OAuth not configured' });
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(getClientMetadataJson());
});

// Initiate OAuth flow
router.post('/authorize', authLimiter, async (req: Request, res: Response) => {
  if (!isOAuthConfigured()) {
    res.send(loginPage('OAuth is not configured. Please use app password login.'));
    return;
  }

  const { handle } = req.body;

  if (!handle) {
    res.send(loginPage('Please provide your handle'));
    return;
  }

  try {
    const authUrl = await initiateOAuth(handle);
    res.redirect(authUrl);
  } catch (error) {
    console.error('OAuth authorize error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start OAuth flow';
    res.send(loginPage(`OAuth error: ${message}`));
  }
});

// OAuth callback handler
router.get('/callback', async (req: Request, res: Response) => {
  if (!isOAuthConfigured()) {
    res.status(404).send('OAuth not configured');
    return;
  }

  try {
    // Get query parameters
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        params.set(key, value);
      }
    }

    // Check for error response
    if (params.has('error')) {
      const error = params.get('error');
      const errorDescription = params.get('error_description') || 'Unknown error';
      console.error('OAuth callback error:', error, errorDescription);
      res.send(loginPage(`OAuth error: ${errorDescription}`));
      return;
    }

    const result = await handleOAuthCallback(params);

    if (!result.success || !result.user || !result.session) {
      res.send(loginPage(result.error || 'OAuth authentication failed'));
      return;
    }

    // Check if this is a new user (needs indexing)
    const isNewUser = !result.user.last_indexed_at;

    // Set session cookie with security flags
    res.cookie('session', result.session.session_token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    });

    // If new user, index their PDS
    if (isNewUser) {
      try {
        console.log(`New OAuth user ${result.user.handle}, indexing PDS...`);
        await indexUserPDS(result.user);
      } catch (error) {
        console.error('Error indexing new user PDS:', error);
        // Continue anyway, they can manually refresh later
      }
    }

    res.redirect('/profile');
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    res.send(loginPage(`OAuth error: ${message}`));
  }
});

export default router;
