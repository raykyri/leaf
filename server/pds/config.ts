/**
 * PDS Configuration
 * Configuration values for the custom PDS implementation
 */

export interface PDSConfig {
  /** PDS hostname (e.g., leaf.example.com) */
  hostname: string;

  /** Public URL of the PDS (e.g., https://leaf.example.com) */
  publicUrl: string;

  /** DID of the PDS service itself (did:web or did:plc) */
  serviceDid: string;

  /** PLC directory URL */
  plcDirectoryUrl: string;

  /** Handle domain for subdomain handles (e.g., leaf.example.com for user.leaf.example.com) */
  handleDomain: string;

  /** Path for blob storage */
  blobStoragePath: string;

  /** Maximum blob size in bytes (default 5MB) */
  maxBlobSize: number;

  /** JWT secret for signing tokens */
  jwtSecret: string;

  /** Access token expiry in seconds (default 15 minutes) */
  accessTokenExpiry: number;

  /** Refresh token expiry in seconds (default 90 days) */
  refreshTokenExpiry: number;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

let _config: PDSConfig | null = null;

export function getPDSConfig(): PDSConfig {
  if (_config) {
    return _config;
  }

  const publicUrl = getEnvOrDefault('PUBLIC_URL', 'http://localhost:5001');
  const hostname = new URL(publicUrl).hostname;

  _config = {
    hostname,
    publicUrl,
    serviceDid: getEnvOrDefault('PDS_DID', `did:web:${hostname}`),
    plcDirectoryUrl: getEnvOrDefault('PLC_DIRECTORY_URL', 'https://plc.directory'),
    handleDomain: getEnvOrDefault('HANDLE_DOMAIN', hostname),
    blobStoragePath: getEnvOrDefault('BLOB_STORAGE_PATH', './data/blobs'),
    maxBlobSize: parseInt(getEnvOrDefault('MAX_BLOB_SIZE', String(5 * 1024 * 1024)), 10),
    jwtSecret: getEnvOrDefault('JWT_SECRET', getEnvOrDefault('SESSION_SECRET', 'dev-secret-change-me')),
    accessTokenExpiry: parseInt(getEnvOrDefault('ACCESS_TOKEN_EXPIRY', String(15 * 60)), 10),
    refreshTokenExpiry: parseInt(getEnvOrDefault('REFRESH_TOKEN_EXPIRY', String(90 * 24 * 60 * 60)), 10),
  };

  return _config;
}

/** Check if PDS is enabled (social auth is configured) */
export function isPDSEnabled(): boolean {
  return !!(process.env.GITHUB_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);
}
