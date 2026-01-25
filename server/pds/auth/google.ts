/**
 * Google OAuth Provider
 *
 * Handles Google OAuth authentication for PDS account creation.
 * Uses OpenID Connect for user information.
 */

import crypto from 'crypto';
import { getPdsConfig } from '../config.ts';
import { generateHandle } from '../identity/handles.ts';
import {
  savePdsOAuthState,
  getPdsOAuthState,
  deletePdsOAuthState,
} from '../database/queries.ts';

export interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface GoogleOAuthState {
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}

/**
 * Generate the Google authorization URL
 */
export function getGoogleAuthorizationUrl(): { url: string; state: string } {
  const config = getPdsConfig();

  if (!config.google) {
    throw new Error('Google OAuth is not configured');
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Generate state and nonce
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');

  // Build redirect URI
  const redirectUri = `${config.publicUrl}/pds/auth/google/callback`;

  // Store state in database for verification
  savePdsOAuthState(state, 'google', {
    codeVerifier,
    nonce,
    redirectUri,
  });

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  return { url, state };
}

/**
 * Exchange authorization code for tokens and fetch user info
 */
export async function handleGoogleCallback(
  code: string,
  state: string
): Promise<GoogleUser> {
  const config = getPdsConfig();

  if (!config.google) {
    throw new Error('Google OAuth is not configured');
  }

  // Verify state from database
  const storedStateData = getPdsOAuthState(state);
  if (!storedStateData) {
    throw new Error('Invalid or expired OAuth state');
  }
  deletePdsOAuthState(state);
  const storedState = storedStateData.data as GoogleOAuthState;

  // Exchange code for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      code,
      redirect_uri: storedState.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: storedState.codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error) {
    throw new Error(`Google OAuth error: ${tokenData.error_description || tokenData.error}`);
  }

  if (!tokenData.access_token) {
    throw new Error('No access token received from Google');
  }

  // Fetch user info from userinfo endpoint
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const user = await userResponse.json() as GoogleUser;

  if (!user.email) {
    throw new Error('Could not retrieve email from Google');
  }

  if (!user.verified_email) {
    throw new Error('Google email is not verified');
  }

  return user;
}

/**
 * Generate a handle from Google user info
 * Uses the shared generateHandle function from identity/handles.ts
 */
export function generateHandleFromGoogle(user: GoogleUser, _domain: string): string {
  // Try to use the email prefix first, fall back to given name
  const username = user.email.split('@')[0] || user.given_name || 'user';
  return generateHandle(username);
}
