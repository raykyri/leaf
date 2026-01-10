import { AtpAgent } from '@atproto/api';
import crypto from 'crypto';
import * as db from '../database/index.js';
import { addRegisteredDid } from './jetstream.js';
import { getOAuthAgent, revokeOAuthSession } from './oauth-client.js';

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: db.User;
  session?: db.Session;
}

export async function authenticateUser(identifier: string, appPassword: string): Promise<AuthResult> {
  try {
    // Normalize handle (remove @ if present)
    const handle = identifier.startsWith('@') ? identifier.slice(1) : identifier;

    // Create agent and login
    // First try to resolve the handle to find the correct PDS
    const agent = new AtpAgent({ service: 'https://bsky.social' });

    try {
      await agent.login({ identifier: handle, password: appPassword });
    } catch (loginError) {
      console.error('Login failed:', loginError);
      return {
        success: false,
        error: 'Invalid credentials. Make sure you are using an app password.'
      };
    }

    if (!agent.session) {
      return {
        success: false,
        error: 'Failed to create session'
      };
    }

    const did = agent.session.did;
    const pdsUrl = agent.pdsUrl?.toString() || 'https://bsky.social';

    // Check if user exists, create if not
    let user = db.getUserByDid(did);
    const isNewUser = !user;

    if (!user) {
      // Get profile for display name
      let displayName: string | undefined;
      try {
        const profile = await agent.getProfile({ actor: did });
        displayName = profile.data.displayName;
      } catch {
        // Profile fetch failed, continue without display name
      }

      user = db.createUser(did, handle, pdsUrl, displayName);
      // Update Jetstream cache so new user's events are processed immediately
      addRegisteredDid(did);
    }

    // Create application session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session = db.createSession(
      user.id,
      sessionToken,
      agent.session.accessJwt,
      agent.session.refreshJwt
    );

    return {
      success: true,
      user,
      session
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'An error occurred during authentication'
    };
  }
}

export function getSessionUser(sessionToken: string): { user: db.User; session: db.Session } | null {
  const session = db.getSessionByToken(sessionToken);
  if (!session) {
    return null;
  }

  const user = db.getUserById(session.user_id);
  if (!user) {
    return null;
  }

  return { user, session };
}

export async function logout(sessionToken: string): Promise<void> {
  // Get session to find user DID for OAuth revocation
  const session = db.getSessionByToken(sessionToken);
  if (session) {
    const user = db.getUserById(session.user_id);
    if (user) {
      // Try to revoke OAuth session (no-op if user didn't use OAuth)
      await revokeOAuthSession(user.did);
    }
  }
  db.deleteSession(sessionToken);
}

export async function getAuthenticatedAgent(session: db.Session, user: db.User): Promise<AtpAgent | null> {
  try {
    // If session has access JWT, use traditional app password auth
    if (session.access_jwt && session.refresh_jwt) {
      const agent = new AtpAgent({
        service: user.pds_url,
        persistSession: (evt, sess) => {
          // Persist refreshed tokens to the database
          if (sess && (evt === 'update' || evt === 'create')) {
            try {
              db.updateSessionTokens(session.id, sess.accessJwt, sess.refreshJwt);
              console.log(`Persisted refreshed tokens for session ${session.id}`);
            } catch (error) {
              console.error('Failed to persist session tokens:', error);
            }
          }
        }
      });

      // Resume session with stored tokens
      await agent.resumeSession({
        did: user.did,
        handle: user.handle,
        accessJwt: session.access_jwt,
        refreshJwt: session.refresh_jwt,
        active: true
      });
      return agent;
    }

    // Otherwise, try OAuth authentication
    const oauthAgent = await getOAuthAgent(user);
    if (oauthAgent) {
      // The OAuth agent is already an Agent, but we need an AtpAgent for compatibility
      // The Agent class from @atproto/api should work the same way
      return oauthAgent as unknown as AtpAgent;
    }

    return null;
  } catch (error) {
    console.error('Failed to get authenticated agent:', error);
    return null;
  }
}
