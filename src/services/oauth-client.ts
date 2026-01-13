import { NodeOAuthClient, type NodeSavedSession, type NodeSavedState } from '@atproto/oauth-client-node';
import { Agent } from '@atproto/api';
import * as db from '../database/index.js';
import { addRegisteredDid } from './jetstream.js';

// Singleton OAuth client instance
let oauthClient: NodeOAuthClient | null = null;

// Get the public URL from environment
function getPublicUrl(): string {
  const url = process.env.PUBLIC_URL;
  if (!url) {
    throw new Error('PUBLIC_URL environment variable must be set for OAuth');
  }
  return url.replace(/\/$/, ''); // Remove trailing slash if present
}

// Check if a URL is a loopback address (localhost or 127.0.0.1 or [::1])
function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

// Get the OAuth client metadata configuration
function getClientMetadata() {
  const publicUrl = getPublicUrl();
  const isLoopback = isLoopbackUrl(publicUrl);

  // For loopback clients, ATProto OAuth spec requires:
  // - client_id must use http://localhost (no port) as the origin
  // - redirect_uris can use the actual loopback address (127.0.0.1, ::1, or localhost)
  // - application_type must be 'native'
  // See: https://atproto.com/specs/oauth#localhost-client-development
  if (isLoopback) {
    return {
      client_name: 'Leaf Blog',
      client_id: `http://localhost/oauth/client-metadata.json`,
      client_uri: publicUrl,
      redirect_uris: [`${publicUrl}/oauth/callback`] as [`${string}`],
      scope: 'atproto transition:generic',
      grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
      response_types: ['code'] as ['code'],
      application_type: 'native' as const,
      token_endpoint_auth_method: 'none' as const,
      dpop_bound_access_tokens: true,
    };
  }

  return {
    client_name: 'Leaf Blog',
    client_id: `${publicUrl}/oauth/client-metadata.json`,
    client_uri: publicUrl,
    redirect_uris: [`${publicUrl}/oauth/callback`] as [`${string}`],
    scope: 'atproto transition:generic',
    grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
    response_types: ['code'] as ['code'],
    application_type: 'web' as const,
    token_endpoint_auth_method: 'none' as const,
    dpop_bound_access_tokens: true,
  };
}

// Create a state store that uses SQLite
function createStateStore() {
  return {
    async get(key: string): Promise<NodeSavedState | undefined> {
      const value = db.getOAuthState(key);
      if (!value) return undefined;
      return JSON.parse(value) as NodeSavedState;
    },
    async set(key: string, value: NodeSavedState): Promise<void> {
      db.setOAuthState(key, JSON.stringify(value));
    },
    async del(key: string): Promise<void> {
      db.deleteOAuthState(key);
    },
  };
}

// Create a session store that uses SQLite
function createSessionStore() {
  return {
    async get(key: string): Promise<NodeSavedSession | undefined> {
      const value = db.getOAuthSession(key);
      if (!value) return undefined;
      return JSON.parse(value) as NodeSavedSession;
    },
    async set(key: string, value: NodeSavedSession): Promise<void> {
      db.setOAuthSession(key, JSON.stringify(value));
    },
    async del(key: string): Promise<void> {
      db.deleteOAuthSession(key);
    },
  };
}

// Initialize and get the OAuth client
export function getOAuthClient(): NodeOAuthClient {
  if (!oauthClient) {
    oauthClient = new NodeOAuthClient({
      clientMetadata: getClientMetadata(),
      stateStore: createStateStore(),
      sessionStore: createSessionStore(),
    });
  }
  return oauthClient;
}

// Get the client metadata for serving at the metadata endpoint
export function getClientMetadataJson() {
  return getClientMetadata();
}

// Initiate OAuth authorization flow
export async function initiateOAuth(handle: string): Promise<string> {
  const client = getOAuthClient();

  // Normalize handle
  const normalizedHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  // Create authorization URL
  const url = await client.authorize(normalizedHandle, {
    scope: 'atproto transition:generic',
  });

  return url.toString();
}

// Handle OAuth callback
export interface OAuthCallbackResult {
  success: boolean;
  error?: string;
  user?: db.User;
  session?: db.Session;
}

export async function handleOAuthCallback(params: URLSearchParams): Promise<OAuthCallbackResult> {
  try {
    const client = getOAuthClient();

    // Process the callback
    const { session: oauthSession } = await client.callback(params);

    // Get user info from the session
    const did = oauthSession.did;

    // Create an agent to get profile info
    const agent = new Agent(oauthSession);

    let handle: string;
    let displayName: string | undefined;
    let pdsUrl: string;

    try {
      const profile = await agent.getProfile({ actor: did });
      handle = profile.data.handle;
      displayName = profile.data.displayName;

      // Get PDS URL from the session's server issuer
      pdsUrl = oauthSession.server.issuer;
    } catch (error) {
      console.error('Failed to get profile:', error);
      return {
        success: false,
        error: 'Failed to get user profile',
      };
    }

    // Check if user exists, create if not
    let user = db.getUserByDid(did);
    const isNewUser = !user;

    if (!user) {
      user = db.createUser(did, handle, pdsUrl, displayName);
      // Update Jetstream cache so new user's events are processed immediately
      addRegisteredDid(did);
    } else {
      // Update handle if it changed
      if (user.handle !== handle) {
        db.updateUserHandle(did, handle);
        user = db.getUserByDid(did)!;
      }
    }

    // Create application session
    // For OAuth sessions, we don't have traditional JWTs, but we keep track in our sessions table
    // The actual tokens are managed by the OAuth client's session store
    const crypto = await import('crypto');
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Create a session without access/refresh JWTs (OAuth handles token management)
    const dbSession = db.createSession(
      user.id,
      sessionToken,
      '', // No direct access JWT - managed by OAuth client
      ''  // No direct refresh JWT - managed by OAuth client
    );

    return {
      success: true,
      user,
      session: dbSession,
    };
  } catch (error) {
    console.error('OAuth callback error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OAuth authentication failed',
    };
  }
}

// Get an authenticated agent for a user who logged in via OAuth
export async function getOAuthAgent(user: db.User): Promise<Agent | null> {
  try {
    const client = getOAuthClient();

    // Restore the OAuth session for this user's DID
    const oauthSession = await client.restore(user.did);

    // Create an agent using the OAuth session
    return new Agent(oauthSession);
  } catch (error) {
    console.error('Failed to get OAuth agent:', error);
    return null;
  }
}

// Check if OAuth is configured
export function isOAuthConfigured(): boolean {
  return !!process.env.PUBLIC_URL;
}

// Revoke OAuth session for a user
export async function revokeOAuthSession(did: string): Promise<void> {
  try {
    const client = getOAuthClient();
    await client.revoke(did);
  } catch (error) {
    console.error('Failed to revoke OAuth session:', error);
    // Continue even if revocation fails
  }
}
