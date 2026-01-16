import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import {
  getClientMetadataJson,
  initiateOAuth,
  handleOAuthCallback,
  isOAuthConfigured,
} from '../services/oauth-client.ts';
import { indexUserPDS } from '../services/indexer.ts';
import { loginPage } from '../views/pages.tsx';
import { authLimiter } from '../middleware/rateLimit.ts';

const oauth = new Hono();

const isProduction = process.env.NODE_ENV === 'production';

// Serve OAuth client metadata (required for ATProto OAuth)
oauth.get('/client-metadata.json', (c) => {
  if (!isOAuthConfigured()) {
    return c.json({ error: 'OAuth not configured' }, 404);
  }

  c.header('Content-Type', 'application/json');
  c.header('Access-Control-Allow-Origin', '*');
  return c.json(getClientMetadataJson());
});

// Initiate OAuth flow
oauth.post('/authorize', authLimiter, async (c) => {
  if (!isOAuthConfigured()) {
    return c.html(loginPage('OAuth is not configured. Please use app password login.'));
  }

  const body = await c.req.parseBody();
  const handle = body.handle as string | undefined;

  if (!handle) {
    return c.html(loginPage('Please provide your handle'));
  }

  try {
    const authUrl = await initiateOAuth(handle);
    return c.redirect(authUrl);
  } catch (error) {
    console.error('OAuth authorize error:', error);
    const message = error instanceof Error ? error.message : 'Failed to start OAuth flow';
    return c.html(loginPage(`OAuth error: ${message}`));
  }
});

// OAuth callback handler
oauth.get('/callback', async (c) => {
  if (!isOAuthConfigured()) {
    return c.text('OAuth not configured', 404);
  }

  try {
    // Get query parameters
    const params = new URLSearchParams();
    const query = c.req.query();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') {
        params.set(key, value);
      }
    }

    // Check for error response
    if (params.has('error')) {
      const error = params.get('error');
      const errorDescription = params.get('error_description') || 'Unknown error';
      console.error('OAuth callback error:', error, errorDescription);
      return c.html(loginPage(`OAuth error: ${errorDescription}`));
    }

    const result = await handleOAuthCallback(params);

    if (!result.success || !result.user || !result.session) {
      return c.html(loginPage(result.error || 'OAuth authentication failed'));
    }

    // Check if this is a new user (needs indexing)
    const isNewUser = !result.user.last_indexed_at;

    // Set session cookie with security flags
    setCookie(c, 'session', result.session.session_token, {
      httpOnly: true,
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      sameSite: 'Lax',
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

    return c.redirect('/profile');
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'OAuth callback failed';
    return c.html(loginPage(`OAuth error: ${message}`));
  }
});

export default oauth;
