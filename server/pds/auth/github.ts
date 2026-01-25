/**
 * GitHub OAuth Provider
 *
 * Handles GitHub OAuth authentication for PDS account creation.
 */

import crypto from 'crypto';
import { getPdsConfig } from '../config.ts';
import { generateHandle } from '../identity/handles.ts';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

export interface GitHubOAuthState {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

// Store OAuth states temporarily (in production, use Redis or database)
const pendingStates = new Map<string, GitHubOAuthState>();

// Clean up old states periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes
  for (const [key, value] of pendingStates) {
    if (now - value.createdAt > maxAge) {
      pendingStates.delete(key);
    }
  }
}, 60 * 1000);

/**
 * Generate the GitHub authorization URL
 */
export function getGitHubAuthorizationUrl(): { url: string; state: string } {
  const config = getPdsConfig();

  if (!config.github) {
    throw new Error('GitHub OAuth is not configured');
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Generate state parameter
  const state = crypto.randomBytes(16).toString('hex');

  // Build redirect URI
  const redirectUri = `${config.publicUrl}/pds/auth/github/callback`;

  // Store state for verification
  pendingStates.set(state, {
    state,
    codeVerifier,
    redirectUri,
    createdAt: Date.now(),
  });

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
    // GitHub doesn't support PKCE, but we'll use the verifier for our own state
  });

  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;

  return { url, state };
}

/**
 * Exchange authorization code for tokens and fetch user info
 */
export async function handleGitHubCallback(
  code: string,
  state: string
): Promise<GitHubUser> {
  const config = getPdsConfig();

  if (!config.github) {
    throw new Error('GitHub OAuth is not configured');
  }

  // Verify state
  const storedState = pendingStates.get(state);
  if (!storedState) {
    throw new Error('Invalid or expired OAuth state');
  }
  pendingStates.delete(state);

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
      redirect_uri: storedState.redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error) {
    throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
  }

  if (!tokenData.access_token) {
    throw new Error('No access token received from GitHub');
  }

  // Fetch user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Leaf-PDS',
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch GitHub user info');
  }

  const user = await userResponse.json() as GitHubUser;

  // If no public email, fetch from emails endpoint
  if (!user.email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Leaf-PDS',
      },
    });

    if (emailsResponse.ok) {
      const emails = await emailsResponse.json() as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;

      // Find primary verified email
      const primaryEmail = emails.find(e => e.primary && e.verified);
      if (primaryEmail) {
        user.email = primaryEmail.email;
      } else {
        // Fall back to any verified email
        const verifiedEmail = emails.find(e => e.verified);
        if (verifiedEmail) {
          user.email = verifiedEmail.email;
        }
      }
    }
  }

  if (!user.email) {
    throw new Error('Could not retrieve email from GitHub. Please ensure your email is verified and accessible.');
  }

  return user;
}

/**
 * Generate a handle from GitHub username
 * Uses the shared generateHandle function from identity/handles.ts
 */
export function generateHandleFromGitHub(username: string, _domain: string): string {
  return generateHandle(username);
}
