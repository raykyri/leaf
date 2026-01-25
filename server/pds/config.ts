/**
 * PDS Configuration
 *
 * Configuration for the Leaf Personal Data Server.
 */

export interface PdsConfig {
  // Server identity
  hostname: string;
  port: number;
  publicUrl: string;

  // Cryptography
  jwtSecret: string;
  keyEncryptionSecret: string;

  // PLC Directory
  plcDirectoryUrl: string;

  // Social login providers
  github: {
    clientId: string;
    clientSecret: string;
  } | null;

  google: {
    clientId: string;
    clientSecret: string;
  } | null;

  // Limits
  maxBlobSize: number;
  maxRecordSize: number;

  // Handle domain (e.g., 'leaf.pub' for user.leaf.pub handles)
  handleDomain: string;
}

export function loadPdsConfig(): PdsConfig {
  const hostname = process.env.PDS_HOSTNAME || 'localhost';
  const port = parseInt(process.env.PDS_PORT || '3334', 10);

  // Determine public URL
  const publicUrl = process.env.PUBLIC_URL ||
    (hostname === 'localhost' ? `http://localhost:${port}` : `https://${hostname}`);

  return {
    hostname,
    port,
    publicUrl,

    // JWT secret for session tokens
    jwtSecret: process.env.PDS_JWT_SECRET || process.env.SESSION_SECRET ||
      (() => { throw new Error('PDS_JWT_SECRET or SESSION_SECRET environment variable is required'); })(),

    // Key encryption secret for storing private keys
    keyEncryptionSecret: process.env.PDS_KEY_ENCRYPTION_SECRET || process.env.SESSION_SECRET ||
      (() => { throw new Error('PDS_KEY_ENCRYPTION_SECRET or SESSION_SECRET environment variable is required'); })(),

    // PLC Directory URL
    plcDirectoryUrl: process.env.PLC_DIRECTORY_URL || 'https://plc.directory',

    // GitHub OAuth (optional)
    github: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    } : null,

    // Google OAuth (optional)
    google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    } : null,

    // Blob size limit (5MB default)
    maxBlobSize: parseInt(process.env.PDS_MAX_BLOB_SIZE || '5242880', 10),

    // Record size limit (150KB default)
    maxRecordSize: parseInt(process.env.PDS_MAX_RECORD_SIZE || '153600', 10),

    // Handle domain
    handleDomain: process.env.PDS_HANDLE_DOMAIN || hostname,
  };
}

// Singleton config instance
let config: PdsConfig | null = null;

export function getPdsConfig(): PdsConfig {
  if (!config) {
    config = loadPdsConfig();
  }
  return config;
}

export function isPdsEnabled(): boolean {
  try {
    const cfg = getPdsConfig();
    // PDS is enabled if at least one social login provider is configured
    return cfg.github !== null || cfg.google !== null;
  } catch {
    return false;
  }
}
