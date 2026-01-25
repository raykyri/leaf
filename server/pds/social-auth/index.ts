/**
 * Social Authentication Service
 * Handles OAuth flow for GitHub and Google, creates ATProto identities for social users
 */

import crypto from 'crypto';
import { getDatabase } from '../../database/index.ts';
import {
  getProviderConfig,
  parseGitHubUserInfo,
  parseGoogleUserInfo,
  type SocialUserInfo,
  type OAuthProviderConfig,
} from './providers.ts';
import {
  generateSigningKey,
  generateRotationKey,
  exportKeyPair,
  encryptKeyPair,
  decryptKeyPair,
  importKeyPair,
  type KeyPair,
  type ExportedKeyPair,
} from '../crypto/keys.ts';
import { createDid, getHandleForUser } from '../identity/index.ts';
import { getPDSConfig } from '../config.ts';
import { initializeRepository } from '../repo/index.ts';

export interface SocialAuthResult {
  success: boolean;
  error?: string;
  userId?: number;
  did?: string;
  handle?: string;
  isNewUser?: boolean;
}

/**
 * Generate authorization URL for a social provider
 */
export function getAuthorizationUrl(
  provider: 'github' | 'google',
  redirectUri: string
): { url: string; state: string } | null {
  const config = getProviderConfig(provider);
  if (!config) {
    return null;
  }

  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  // Store state in database
  const db = getDatabase();
  db.prepare(
    'INSERT INTO social_oauth_state (state, provider, redirect_uri) VALUES (?, ?, ?)'
  ).run(state, provider, redirectUri);

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(' '),
    state,
    response_type: 'code',
  });

  // Google-specific parameters
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  return {
    url: `${config.authorizationUrl}?${params.toString()}`,
    state,
  };
}

/**
 * Validate OAuth state and return provider info
 */
export function validateOAuthState(
  state: string
): { provider: 'github' | 'google'; redirectUri: string | null } | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT provider, redirect_uri FROM social_oauth_state WHERE state = ?')
    .get(state) as { provider: string; redirect_uri: string | null } | undefined;

  if (!row) {
    return null;
  }

  // Delete used state
  db.prepare('DELETE FROM social_oauth_state WHERE state = ?').run(state);

  // Clean up old states (older than 10 minutes)
  db.prepare(
    "DELETE FROM social_oauth_state WHERE created_at < datetime('now', '-10 minutes')"
  ).run();

  return {
    provider: row.provider as 'github' | 'google',
    redirectUri: row.redirect_uri,
  };
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  config: OAuthProviderConfig,
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  try {
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: params.toString(),
    });

    if (!response.ok) {
      console.error('Token exchange failed:', await response.text());
      return null;
    }

    const data = await response.json() as { access_token: string; refresh_token?: string };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch (error) {
    console.error('Token exchange error:', error);
    return null;
  }
}

/**
 * Fetch user info from provider
 */
async function fetchUserInfo(
  provider: 'github' | 'google',
  config: OAuthProviderConfig,
  accessToken: string
): Promise<SocialUserInfo | null> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    // For GitHub, we need User-Agent
    if (provider === 'github') {
      headers['User-Agent'] = 'Leaf-App';
    }

    const response = await fetch(config.userInfoUrl, { headers });

    if (!response.ok) {
      console.error('User info fetch failed:', await response.text());
      return null;
    }

    const userData = await response.json() as Record<string, any>;

    // For GitHub, also fetch emails if not public
    let emails: any[] | undefined;
    if (provider === 'github' && !userData.email) {
      try {
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers,
        });
        if (emailResponse.ok) {
          emails = await emailResponse.json();
        }
      } catch {
        // Email fetch failed, continue without
      }
    }

    if (provider === 'github') {
      return parseGitHubUserInfo(userData, emails);
    } else {
      return parseGoogleUserInfo(userData);
    }
  } catch (error) {
    console.error('User info fetch error:', error);
    return null;
  }
}

/**
 * Handle OAuth callback - complete the OAuth flow
 */
export async function handleOAuthCallback(
  code: string,
  state: string,
  redirectUri: string
): Promise<SocialAuthResult> {
  // Validate state
  const stateInfo = validateOAuthState(state);
  if (!stateInfo) {
    return { success: false, error: 'Invalid or expired OAuth state' };
  }

  const { provider } = stateInfo;
  const config = getProviderConfig(provider);
  if (!config) {
    return { success: false, error: 'Provider not configured' };
  }

  // Exchange code for token
  const tokenResult = await exchangeCodeForToken(config, code, redirectUri);
  if (!tokenResult) {
    return { success: false, error: 'Failed to exchange authorization code' };
  }

  // Fetch user info
  const userInfo = await fetchUserInfo(provider, config, tokenResult.accessToken);
  if (!userInfo) {
    return { success: false, error: 'Failed to fetch user information' };
  }

  // Find or create user
  return findOrCreateSocialUser(userInfo, tokenResult.accessToken, tokenResult.refreshToken);
}

/**
 * Find existing user or create new one for social login
 */
async function findOrCreateSocialUser(
  userInfo: SocialUserInfo,
  accessToken: string,
  refreshToken?: string
): Promise<SocialAuthResult> {
  const db = getDatabase();
  const config = getPDSConfig();

  // Check if social account already exists
  const existingAccount = db
    .prepare('SELECT user_id FROM social_accounts WHERE provider = ? AND provider_user_id = ?')
    .get(userInfo.provider, userInfo.providerId) as { user_id: number } | undefined;

  if (existingAccount) {
    // Update tokens and return existing user
    db.prepare(
      `UPDATE social_accounts SET
        access_token = ?,
        refresh_token = ?,
        email = ?,
        display_name = ?,
        avatar_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE provider = ? AND provider_user_id = ?`
    ).run(
      accessToken,
      refreshToken || null,
      userInfo.email,
      userInfo.displayName,
      userInfo.avatarUrl,
      userInfo.provider,
      userInfo.providerId
    );

    // Get user details
    const user = db
      .prepare('SELECT did, handle FROM users WHERE id = ?')
      .get(existingAccount.user_id) as { did: string; handle: string };

    return {
      success: true,
      userId: existingAccount.user_id,
      did: user.did,
      handle: user.handle,
      isNewUser: false,
    };
  }

  // Create new user with ATProto identity
  try {
    // Generate signing and rotation keys
    const signingKey = await generateSigningKey();
    const rotationKey = await generateRotationKey();

    // Generate handle for user
    const handle = await getHandleForUser(userInfo);

    // Create DID:PLC for this user
    const did = await createDid(signingKey, rotationKey, handle);

    // Encrypt keys for storage
    const encryptedSigningKey = encryptKeyPair(exportKeyPair(signingKey), config.jwtSecret);
    const encryptedRotationKey = encryptKeyPair(exportKeyPair(rotationKey), config.jwtSecret);

    // Create user record
    const userResult = db
      .prepare(
        `INSERT INTO users (did, handle, pds_url, display_name, auth_type, signing_key, rotation_key)
        VALUES (?, ?, ?, ?, 'social', ?, ?)`
      )
      .run(
        did,
        handle,
        config.publicUrl,
        userInfo.displayName,
        encryptedSigningKey,
        encryptedRotationKey
      );

    const userId = userResult.lastInsertRowid as number;

    // Create social account link
    db.prepare(
      `INSERT INTO social_accounts (user_id, provider, provider_user_id, email, display_name, avatar_url, access_token, refresh_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      userInfo.provider,
      userInfo.providerId,
      userInfo.email,
      userInfo.displayName,
      userInfo.avatarUrl,
      accessToken,
      refreshToken || null
    );

    // Initialize empty repository for user
    await initializeRepository(did, signingKey);

    return {
      success: true,
      userId,
      did,
      handle,
      isNewUser: true,
    };
  } catch (error) {
    console.error('Failed to create social user:', error);
    return { success: false, error: 'Failed to create user account' };
  }
}

/**
 * Get signing key for a social user
 */
export async function getSocialUserSigningKey(userId: number): Promise<KeyPair | null> {
  const db = getDatabase();
  const config = getPDSConfig();

  const user = db
    .prepare('SELECT signing_key FROM users WHERE id = ? AND auth_type = ?')
    .get(userId, 'social') as { signing_key: string } | undefined;

  if (!user || !user.signing_key) {
    return null;
  }

  try {
    const exported = decryptKeyPair(user.signing_key, config.jwtSecret);
    return importKeyPair(exported);
  } catch (error) {
    console.error('Failed to decrypt signing key:', error);
    return null;
  }
}

/**
 * Get rotation key for a social user
 */
export async function getSocialUserRotationKey(userId: number): Promise<KeyPair | null> {
  const db = getDatabase();
  const config = getPDSConfig();

  const user = db
    .prepare('SELECT rotation_key FROM users WHERE id = ? AND auth_type = ?')
    .get(userId, 'social') as { rotation_key: string } | undefined;

  if (!user || !user.rotation_key) {
    return null;
  }

  try {
    const exported = decryptKeyPair(user.rotation_key, config.jwtSecret);
    return importKeyPair(exported);
  } catch (error) {
    console.error('Failed to decrypt rotation key:', error);
    return null;
  }
}

export { getAvailableProviders } from './providers.ts';
