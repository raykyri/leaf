/**
 * Social OAuth Provider Configurations
 * Defines OAuth endpoints and scopes for GitHub and Google
 */

export interface OAuthProviderConfig {
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
}

export interface SocialUserInfo {
  provider: 'github' | 'google';
  providerId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  username: string | null;
}

export function getGitHubConfig(): OAuthProviderConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    name: 'github',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    clientId,
    clientSecret,
  };
}

export function getGoogleConfig(): OAuthProviderConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    name: 'google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientId,
    clientSecret,
  };
}

export function getProviderConfig(provider: 'github' | 'google'): OAuthProviderConfig | null {
  switch (provider) {
    case 'github':
      return getGitHubConfig();
    case 'google':
      return getGoogleConfig();
    default:
      return null;
  }
}

export function getAvailableProviders(): Array<'github' | 'google'> {
  const providers: Array<'github' | 'google'> = [];
  if (getGitHubConfig()) providers.push('github');
  if (getGoogleConfig()) providers.push('google');
  return providers;
}

/**
 * Parse user info response from GitHub
 */
export function parseGitHubUserInfo(data: any, emails?: any[]): SocialUserInfo {
  // Find primary email from emails endpoint if available
  let email = data.email;
  if (!email && emails && emails.length > 0) {
    const primaryEmail = emails.find((e: any) => e.primary && e.verified);
    email = primaryEmail?.email || emails[0]?.email || null;
  }

  return {
    provider: 'github',
    providerId: String(data.id),
    email,
    displayName: data.name || data.login || null,
    avatarUrl: data.avatar_url || null,
    username: data.login || null,
  };
}

/**
 * Parse user info response from Google
 */
export function parseGoogleUserInfo(data: any): SocialUserInfo {
  return {
    provider: 'google',
    providerId: data.id,
    email: data.email || null,
    displayName: data.name || null,
    avatarUrl: data.picture || null,
    username: null, // Google doesn't provide a username
  };
}
