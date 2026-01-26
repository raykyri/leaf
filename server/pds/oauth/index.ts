/**
 * OAuth Authorization Server
 * Implements ATProto OAuth 2.0 for third-party client authentication
 * Supports PKCE, DPoP, and PAR as required by ATProto spec
 */

import type { Context } from 'hono';
import type { Hono } from 'hono';
import crypto from 'crypto';
import { getPDSConfig } from '../config.ts';
import { getDatabase } from '../../database/index.ts';
import { escapeHtml } from '../utils.ts';

// PDS signing key for JWT tokens (generated on first use, stored encrypted)
let pdsSigningKey: crypto.KeyObject | null = null;
let pdsSigningKeyKid: string | null = null;

/**
 * Get or generate the PDS signing key for JWT tokens
 */
async function getPDSSigningKey(): Promise<{ key: crypto.KeyObject; kid: string }> {
  if (pdsSigningKey && pdsSigningKeyKid) {
    return { key: pdsSigningKey, kid: pdsSigningKeyKid };
  }

  const config = getPDSConfig();
  const db = getDatabase();

  // Try to load existing key from database
  const row = db
    .prepare('SELECT key_data, kid FROM pds_signing_keys WHERE active = 1 LIMIT 1')
    .get() as { key_data: string; kid: string } | undefined;

  if (row) {
    // Decrypt and load existing key
    const keyData = decryptPDSKey(row.key_data, config.jwtSecret);
    pdsSigningKey = crypto.createPrivateKey({ key: keyData, format: 'jwk' });
    pdsSigningKeyKid = row.kid;
    return { key: pdsSigningKey, kid: pdsSigningKeyKid };
  }

  // Generate new key pair (ES256 - P-256 curve)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });

  // Export private key as JWK for storage
  const privateJwk = privateKey.export({ format: 'jwk' });
  const publicJwk = publicKey.export({ format: 'jwk' });

  // Calculate kid from public key thumbprint
  const kid = calculateJwkThumbprint(publicJwk as Record<string, unknown>);

  // Encrypt and store the key
  const encryptedKey = encryptPDSKey(JSON.stringify(privateJwk), config.jwtSecret);

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS pds_signing_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kid TEXT UNIQUE NOT NULL,
      key_data TEXT NOT NULL,
      public_jwk TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.prepare(
    'INSERT INTO pds_signing_keys (kid, key_data, public_jwk, active) VALUES (?, ?, ?, 1)'
  ).run(kid, encryptedKey, JSON.stringify(publicJwk));

  pdsSigningKey = privateKey;
  pdsSigningKeyKid = kid;

  return { key: pdsSigningKey, kid: pdsSigningKeyKid };
}

/**
 * Encrypt PDS signing key for storage
 */
function encryptPDSKey(data: string, secret: string): string {
  const salt = crypto.randomBytes(32);
  const key = crypto.scryptSync(secret, salt, 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt PDS signing key from storage
 */
function decryptPDSKey(encryptedData: string, secret: string): crypto.JsonWebKey {
  const [saltB64, ivB64, authTagB64, encryptedB64] = encryptedData.split(':');

  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const key = crypto.scryptSync(secret, salt, 32);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Generate a JWT access token
 */
async function generateAccessTokenJWT(
  subject: string,
  clientId: string,
  scope: string,
  dpopJkt: string,
  expiresInSeconds: number
): Promise<string> {
  const config = getPDSConfig();
  const { key, kid } = await getPDSSigningKey();

  const now = Math.floor(Date.now() / 1000);

  // JWT Header
  const header = {
    alg: 'ES256',
    typ: 'at+jwt', // ATProto access token type
    kid,
  };

  // JWT Payload
  const payload = {
    iss: config.publicUrl, // Issuer
    sub: subject, // Subject (user DID)
    aud: config.publicUrl, // Audience (this PDS)
    exp: now + expiresInSeconds, // Expiration
    iat: now, // Issued at
    jti: crypto.randomBytes(16).toString('hex'), // JWT ID
    scope, // OAuth scopes
    client_id: clientId, // Client that requested the token
    cnf: {
      jkt: dpopJkt, // DPoP key thumbprint for binding
    },
  };

  // Encode header and payload
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;

  // Sign with ES256
  const signer = crypto.createSign('SHA256');
  signer.update(signingInput);
  const signature = signer.sign(key);

  // Convert DER signature to raw format (r || s) for JWT
  const rawSignature = derToRaw(signature, 'ES256');

  return `${signingInput}.${rawSignature.toString('base64url')}`;
}

/**
 * Convert DER signature to raw format (r || s)
 */
function derToRaw(signature: Buffer, alg: string): Buffer {
  const sizes: Record<string, number> = { ES256: 32, ES384: 48, ES512: 66 };
  const size = sizes[alg];

  // Parse DER: 0x30 [len] 0x02 [r_len] [r] 0x02 [s_len] [s]
  let offset = 2; // Skip sequence tag and length
  if (signature[1] & 0x80) {
    offset += signature[1] & 0x7f; // Extended length
  }

  // Read r
  if (signature[offset] !== 0x02) {
    return signature; // Not valid DER, return as-is
  }
  offset++;
  const rLen = signature[offset++];
  let r = signature.subarray(offset, offset + rLen);
  offset += rLen;

  // Read s
  if (signature[offset] !== 0x02) {
    return signature;
  }
  offset++;
  const sLen = signature[offset++];
  let s = signature.subarray(offset, offset + sLen);

  // Remove leading zeros and pad to size
  if (r.length > size && r[0] === 0) r = r.subarray(1);
  if (s.length > size && s[0] === 0) s = s.subarray(1);

  const result = Buffer.alloc(size * 2);
  r.copy(result, size - r.length);
  s.copy(result, size * 2 - s.length);

  return result;
}

/**
 * Get JWKS (JSON Web Key Set) for token verification
 */
export async function getJWKS(): Promise<{ keys: crypto.JsonWebKey[] }> {
  const { kid } = await getPDSSigningKey();
  const db = getDatabase();

  const row = db
    .prepare('SELECT public_jwk FROM pds_signing_keys WHERE kid = ?')
    .get(kid) as { public_jwk: string } | undefined;

  if (!row) {
    return { keys: [] };
  }

  const publicJwk = JSON.parse(row.public_jwk);
  publicJwk.kid = kid;
  publicJwk.use = 'sig';
  publicJwk.alg = 'ES256';

  return { keys: [publicJwk] };
}

// DPoP proof maximum age (5 minutes)
const DPOP_MAX_AGE_MS = 5 * 60 * 1000;

// Track used DPoP jti values to prevent replay (in-memory, would use Redis in production)
const usedDPoPJtis = new Map<string, number>();

// CSRF token expiry (10 minutes)
const CSRF_TOKEN_EXPIRY_MS = 10 * 60 * 1000;

// Track CSRF tokens (in-memory for simplicity, would use database in production)
const csrfTokens = new Map<string, { requestUri: string; createdAt: number }>();

// Clean up old jti values and CSRF tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [jti, timestamp] of usedDPoPJtis) {
    if (now - timestamp > DPOP_MAX_AGE_MS * 2) {
      usedDPoPJtis.delete(jti);
    }
  }
  for (const [token, data] of csrfTokens) {
    if (now - data.createdAt > CSRF_TOKEN_EXPIRY_MS * 2) {
      csrfTokens.delete(token);
    }
  }
}, 60000);

/**
 * Generate a CSRF token for the authorization form
 */
function generateCsrfToken(requestUri: string): string {
  const token = crypto.randomBytes(32).toString('base64url');
  csrfTokens.set(token, { requestUri, createdAt: Date.now() });
  return token;
}

/**
 * Validate a CSRF token
 */
function validateCsrfToken(token: string, requestUri: string): boolean {
  const data = csrfTokens.get(token);
  if (!data) {
    return false;
  }

  // Check expiry
  if (Date.now() - data.createdAt > CSRF_TOKEN_EXPIRY_MS) {
    csrfTokens.delete(token);
    return false;
  }

  // Check request_uri matches
  if (data.requestUri !== requestUri) {
    return false;
  }

  // Delete token after use (single use)
  csrfTokens.delete(token);
  return true;
}

/**
 * DPoP proof validation result
 */
export interface DPoPValidationResult {
  valid: boolean;
  jkt?: string;
  error?: string;
}

/**
 * Validate a DPoP proof JWT
 * @param dpopHeader - The DPoP header value (a JWT)
 * @param httpMethod - The HTTP method of the request
 * @param httpUri - The HTTP URI of the request
 * @param expectedJkt - Optional expected JWK thumbprint (for token binding verification)
 */
export function validateDPoPProof(
  dpopHeader: string,
  httpMethod: string,
  httpUri: string,
  expectedJkt?: string
): DPoPValidationResult {
  try {
    // Parse the JWT (header.payload.signature)
    const parts = dpopHeader.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid DPoP JWT format' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

    // Validate header
    if (header.typ !== 'dpop+jwt') {
      return { valid: false, error: 'Invalid DPoP typ' };
    }

    if (!['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512'].includes(header.alg)) {
      return { valid: false, error: 'Unsupported DPoP algorithm' };
    }

    if (!header.jwk) {
      return { valid: false, error: 'Missing JWK in DPoP header' };
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Validate payload claims
    if (!payload.jti || typeof payload.jti !== 'string') {
      return { valid: false, error: 'Missing or invalid jti claim' };
    }

    if (!payload.htm || payload.htm !== httpMethod) {
      return { valid: false, error: 'HTTP method mismatch' };
    }

    if (!payload.htu) {
      return { valid: false, error: 'Missing htu claim' };
    }

    // Normalize and compare URIs (ignore query string and fragment)
    const proofUri = new URL(payload.htu);
    const requestUri = new URL(httpUri);
    if (proofUri.origin + proofUri.pathname !== requestUri.origin + requestUri.pathname) {
      return { valid: false, error: 'HTTP URI mismatch' };
    }

    if (!payload.iat || typeof payload.iat !== 'number') {
      return { valid: false, error: 'Missing or invalid iat claim' };
    }

    // Check timestamp (allow 5 minute window)
    const now = Math.floor(Date.now() / 1000);
    if (payload.iat > now + 60) {
      return { valid: false, error: 'DPoP proof issued in the future' };
    }
    if (payload.iat < now - 300) {
      return { valid: false, error: 'DPoP proof expired' };
    }

    // Check for replay (jti uniqueness)
    if (usedDPoPJtis.has(payload.jti)) {
      return { valid: false, error: 'DPoP jti already used (replay attack)' };
    }

    // Calculate JWK thumbprint
    const jkt = calculateJwkThumbprint(header.jwk);

    // If expected JKT provided, verify it matches
    if (expectedJkt && jkt !== expectedJkt) {
      return { valid: false, error: 'JWK thumbprint mismatch' };
    }

    // Verify signature
    const signatureValid = verifyDPoPSignature(
      header.alg,
      header.jwk,
      `${headerB64}.${payloadB64}`,
      signatureB64
    );

    if (!signatureValid) {
      return { valid: false, error: 'Invalid DPoP signature' };
    }

    // Mark jti as used
    usedDPoPJtis.set(payload.jti, Date.now());

    return { valid: true, jkt };
  } catch (error) {
    console.error('DPoP validation error:', error);
    return { valid: false, error: 'DPoP validation failed' };
  }
}

/**
 * Calculate JWK thumbprint (RFC 7638)
 * For EC keys: {"crv":"...","kty":"EC","x":"...","y":"..."}
 * For RSA keys: {"e":"...","kty":"RSA","n":"..."}
 */
function calculateJwkThumbprint(jwk: Record<string, unknown>): string {
  let normalized: Record<string, unknown>;

  if (jwk.kty === 'EC') {
    normalized = {
      crv: jwk.crv,
      kty: jwk.kty,
      x: jwk.x,
      y: jwk.y,
    };
  } else if (jwk.kty === 'RSA') {
    normalized = {
      e: jwk.e,
      kty: jwk.kty,
      n: jwk.n,
    };
  } else if (jwk.kty === 'OKP') {
    normalized = {
      crv: jwk.crv,
      kty: jwk.kty,
      x: jwk.x,
    };
  } else {
    throw new Error(`Unsupported key type: ${jwk.kty}`);
  }

  // JSON with sorted keys, no whitespace
  const json = JSON.stringify(normalized, Object.keys(normalized).sort());
  const hash = crypto.createHash('sha256').update(json).digest();
  return hash.toString('base64url');
}

/**
 * Verify DPoP signature
 */
function verifyDPoPSignature(
  alg: string,
  jwk: Record<string, unknown>,
  data: string,
  signatureB64: string
): boolean {
  try {
    const signature = Buffer.from(signatureB64, 'base64url');

    // Convert JWK to Node.js key object
    const keyObject = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' });

    // Map JWT algorithm to Node.js algorithm
    const algMap: Record<string, string> = {
      ES256: 'sha256',
      ES384: 'sha384',
      ES512: 'sha512',
      RS256: 'sha256',
      RS384: 'sha384',
      RS512: 'sha512',
    };

    const hashAlg = algMap[alg];
    if (!hashAlg) {
      return false;
    }

    // For ECDSA, the signature needs to be converted from raw format to DER
    let sig = signature;
    if (alg.startsWith('ES')) {
      sig = ecdsaRawToDer(signature, alg);
    }

    const verifier = crypto.createVerify(hashAlg);
    verifier.update(data);
    return verifier.verify(keyObject, sig);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Convert ECDSA raw signature (r || s) to DER format
 */
function ecdsaRawToDer(signature: Buffer, alg: string): Buffer {
  // Determine component size based on algorithm
  const sizes: Record<string, number> = { ES256: 32, ES384: 48, ES512: 66 };
  const size = sizes[alg];

  if (!size || signature.length !== size * 2) {
    return signature; // Return as-is if format doesn't match
  }

  const r = signature.subarray(0, size);
  const s = signature.subarray(size);

  // Remove leading zeros but ensure positive (add 0x00 if high bit set)
  const trimInt = (buf: Buffer): Buffer => {
    let i = 0;
    while (i < buf.length - 1 && buf[i] === 0 && !(buf[i + 1] & 0x80)) {
      i++;
    }
    const trimmed = buf.subarray(i);
    if (trimmed[0] & 0x80) {
      return Buffer.concat([Buffer.from([0x00]), trimmed]);
    }
    return trimmed;
  };

  const rTrimmed = trimInt(r);
  const sTrimmed = trimInt(s);

  // DER SEQUENCE: 0x30 [total length] 0x02 [r length] [r] 0x02 [s length] [s]
  const totalLen = 2 + rTrimmed.length + 2 + sTrimmed.length;

  return Buffer.concat([
    Buffer.from([0x30, totalLen]),
    Buffer.from([0x02, rTrimmed.length]),
    rTrimmed,
    Buffer.from([0x02, sTrimmed.length]),
    sTrimmed,
  ]);
}

const AUTH_CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Valid ATProto OAuth scopes
const VALID_ATPROTO_SCOPES = new Set([
  'atproto',
  'transition:generic',
  'transition:chat.bsky',
]);

// Client metadata cache (in-memory, would use Redis in production)
const clientMetadataCache = new Map<string, { metadata: OAuthClientMetadata; fetchedAt: number }>();
const CLIENT_METADATA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * OAuth Client Metadata (per ATProto OAuth spec)
 */
export interface OAuthClientMetadata {
  client_id: string;
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  tos_uri?: string;
  policy_uri?: string;
  redirect_uris: string[];
  scope?: string;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
  application_type?: string;
  dpop_bound_access_tokens?: boolean;
}

/**
 * Validate that client_id is a valid OAuth client identifier URL
 * Per ATProto spec: must be HTTPS URL (http://localhost allowed for development)
 */
function validateClientIdFormat(clientId: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(clientId);

    // Must be http or https
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { valid: false, error: 'client_id must be an HTTP(S) URL' };
    }

    // HTTP is only allowed for localhost (development)
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return { valid: false, error: 'client_id must use HTTPS (HTTP only allowed for localhost)' };
    }

    // Must not have fragment
    if (url.hash) {
      return { valid: false, error: 'client_id must not contain a fragment' };
    }

    // Must not have username/password
    if (url.username || url.password) {
      return { valid: false, error: 'client_id must not contain credentials' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'client_id must be a valid URL' };
  }
}

/**
 * Fetch OAuth client metadata from client_id URL
 * Per ATProto spec: client_id URL should serve client metadata as JSON
 */
async function fetchClientMetadata(clientId: string): Promise<{ metadata?: OAuthClientMetadata; error?: string }> {
  // Check cache first
  const cached = clientMetadataCache.get(clientId);
  if (cached && Date.now() - cached.fetchedAt < CLIENT_METADATA_CACHE_TTL_MS) {
    return { metadata: cached.metadata };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(clientId, {
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { error: `Failed to fetch client metadata: HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { error: 'Client metadata must be served as application/json' };
    }

    const metadata = await response.json() as OAuthClientMetadata;

    // Validate required fields
    if (!metadata.client_id) {
      return { error: 'Client metadata missing client_id' };
    }

    // Verify client_id matches the URL we fetched from
    if (metadata.client_id !== clientId) {
      return { error: 'Client metadata client_id does not match URL' };
    }

    if (!Array.isArray(metadata.redirect_uris) || metadata.redirect_uris.length === 0) {
      return { error: 'Client metadata must include redirect_uris array' };
    }

    // Cache the metadata
    clientMetadataCache.set(clientId, { metadata, fetchedAt: Date.now() });

    return { metadata };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: 'Timeout fetching client metadata' };
    }
    return { error: `Failed to fetch client metadata: ${error}` };
  }
}

/**
 * Validate redirect_uri against client metadata
 */
function validateRedirectUri(redirectUri: string, metadata: OAuthClientMetadata): { valid: boolean; error?: string } {
  // Check if redirect_uri is in the registered list
  if (!metadata.redirect_uris.includes(redirectUri)) {
    return {
      valid: false,
      error: 'redirect_uri not registered for this client'
    };
  }

  // Validate redirect_uri format
  try {
    const url = new URL(redirectUri);

    // Must be http or https (or custom scheme for native apps)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      // Allow custom schemes for native apps, but they must be registered
      if (!metadata.redirect_uris.includes(redirectUri)) {
        return { valid: false, error: 'Custom scheme redirect_uri not registered' };
      }
    }

    // HTTP only allowed for localhost
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return { valid: false, error: 'redirect_uri must use HTTPS (HTTP only allowed for localhost)' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'redirect_uri must be a valid URL' };
  }
}

/**
 * Validate OAuth scopes
 * Per ATProto spec: validates that requested scopes are valid ATProto scopes
 */
function validateScopes(scope: string): { valid: boolean; error?: string; scopes?: string[] } {
  if (!scope || scope.trim() === '') {
    // Default to 'atproto' scope if none specified
    return { valid: true, scopes: ['atproto'] };
  }

  const requestedScopes = scope.split(' ').filter(s => s.length > 0);

  if (requestedScopes.length === 0) {
    return { valid: true, scopes: ['atproto'] };
  }

  // Check each scope is valid
  const invalidScopes = requestedScopes.filter(s => !VALID_ATPROTO_SCOPES.has(s));

  if (invalidScopes.length > 0) {
    return {
      valid: false,
      error: `Invalid scope(s): ${invalidScopes.join(', ')}. Valid scopes: ${[...VALID_ATPROTO_SCOPES].join(', ')}`
    };
  }

  return { valid: true, scopes: requestedScopes };
}

export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  dpopJkt?: string;
}

/**
 * Mount OAuth routes
 */
export function mountOAuthRoutes(app: Hono): void {
  // Pushed Authorization Request endpoint
  app.post('/oauth/par', handlePAR);

  // Authorization endpoint
  app.get('/oauth/authorize', handleAuthorize);
  app.post('/oauth/authorize', handleAuthorizeSubmit);

  // Token endpoint
  app.post('/oauth/token', handleToken);

  // Token revocation
  app.post('/oauth/revoke', handleRevoke);

  // JWKS endpoint for token verification
  app.get('/oauth/jwks', handleJWKS);
}

/**
 * JWKS endpoint - returns public keys for token verification
 */
async function handleJWKS(c: Context): Promise<Response> {
  try {
    const jwks = await getJWKS();
    return c.json(jwks, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('JWKS error:', error);
    return c.json({ error: 'server_error' }, 500);
  }
}

/**
 * Pushed Authorization Request (PAR) endpoint
 * Clients must use PAR to initiate authorization
 */
async function handlePAR(c: Context): Promise<Response> {
  try {
    const body = await parseFormBody(c);
    const config = getPDSConfig();

    const clientId = body.client_id;
    const redirectUri = body.redirect_uri;
    const scope = body.scope || 'atproto';
    const codeChallenge = body.code_challenge;
    const codeChallengeMethod = body.code_challenge_method;
    const state = body.state;

    // Validate DPoP proof if provided
    let dpopJkt: string | undefined;
    const dpopHeader = c.req.header('DPoP');
    if (dpopHeader) {
      const dpopResult = validateDPoPProof(
        dpopHeader,
        'POST',
        `${config.publicUrl}/oauth/par`
      );
      if (!dpopResult.valid) {
        return c.json(
          { error: 'invalid_dpop_proof', error_description: dpopResult.error },
          400
        );
      }
      dpopJkt = dpopResult.jkt;
    }

    // Validate required parameters
    if (!clientId || !redirectUri || !codeChallenge) {
      return c.json(
        { error: 'invalid_request', error_description: 'Missing required parameters' },
        400
      );
    }

    // Validate client_id format
    const clientIdValidation = validateClientIdFormat(clientId);
    if (!clientIdValidation.valid) {
      return c.json(
        { error: 'invalid_client', error_description: clientIdValidation.error },
        400
      );
    }

    // Fetch and validate client metadata
    const metadataResult = await fetchClientMetadata(clientId);
    if (metadataResult.error) {
      return c.json(
        { error: 'invalid_client', error_description: metadataResult.error },
        400
      );
    }

    // Validate redirect_uri against client metadata
    const redirectValidation = validateRedirectUri(redirectUri, metadataResult.metadata!);
    if (!redirectValidation.valid) {
      return c.json(
        { error: 'invalid_request', error_description: redirectValidation.error },
        400
      );
    }

    // Validate scopes
    const scopeValidation = validateScopes(scope);
    if (!scopeValidation.valid) {
      return c.json(
        { error: 'invalid_scope', error_description: scopeValidation.error },
        400
      );
    }
    const validatedScope = scopeValidation.scopes!.join(' ');

    // Validate code challenge method
    if (codeChallengeMethod !== 'S256') {
      return c.json(
        { error: 'invalid_request', error_description: 'Only S256 code challenge method supported' },
        400
      );
    }

    // Validate code challenge format (S256 produces 43 char base64url hash)
    if (codeChallenge.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(codeChallenge)) {
      return c.json(
        { error: 'invalid_request', error_description: 'Invalid code challenge format' },
        400
      );
    }

    // Generate request URI
    const requestUri = `urn:ietf:params:oauth:request_uri:${crypto.randomBytes(16).toString('hex')}`;
    const expiresIn = 60; // 60 seconds

    // Store PAR request
    const db = getDatabase();
    db.prepare(
      `INSERT INTO pds_oauth_codes
       (code, user_did, client_id, redirect_uri, scope, code_challenge, code_challenge_method, dpop_jkt, expires_at)
       VALUES (?, '', ?, ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' seconds'))`
    ).run(requestUri, clientId, redirectUri, validatedScope, codeChallenge, codeChallengeMethod, dpopJkt, expiresIn);

    return c.json({
      request_uri: requestUri,
      expires_in: expiresIn,
    });
  } catch (error) {
    console.error('PAR error:', error);
    return c.json({ error: 'server_error', error_description: 'Internal error' }, 500);
  }
}

/**
 * Authorization endpoint - displays consent screen
 * ATProto requires PAR (Pushed Authorization Request) - clients must first
 * POST to /oauth/par and use the returned request_uri here.
 */
async function handleAuthorize(c: Context): Promise<Response> {
  const requestUri = c.req.query('request_uri');

  // PAR is required per ATProto OAuth spec
  if (!requestUri) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: 'Pushed Authorization Request (PAR) is required. Use POST /oauth/par first.',
      },
      400
    );
  }

  // Validate request_uri format
  if (!requestUri.startsWith('urn:ietf:params:oauth:request_uri:')) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: 'Invalid request_uri format',
      },
      400
    );
  }

  // Look up PAR request
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT client_id, redirect_uri, scope, code_challenge, code_challenge_method, dpop_jkt
       FROM pds_oauth_codes
       WHERE code = ? AND user_did = '' AND expires_at > datetime('now')`
    )
    .get(requestUri) as {
    client_id: string;
    redirect_uri: string;
    scope: string;
    code_challenge: string;
    code_challenge_method: string;
    dpop_jkt: string | null;
  } | undefined;

  if (!row) {
    return c.json({ error: 'invalid_request', error_description: 'Request expired or not found' }, 400);
  }

  const authRequest: AuthorizationRequest = {
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    scope: row.scope,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: row.code_challenge_method,
    dpopJkt: row.dpop_jkt || undefined,
  };

  // Generate CSRF token for the form
  const csrfToken = generateCsrfToken(requestUri);

  // Render authorization page with security headers
  const config = getPDSConfig();
  const html = renderAuthorizePage(authRequest, config.publicUrl, csrfToken, requestUri);

  return c.html(html, {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    },
  });
}

/**
 * Handle authorization form submission
 */
async function handleAuthorizeSubmit(c: Context): Promise<Response> {
  const body = await parseFormBody(c);

  const action = body.action;
  const clientId = body.client_id;
  const redirectUri = body.redirect_uri;
  const scope = body.scope;
  const codeChallenge = body.code_challenge;
  const codeChallengeMethod = body.code_challenge_method;
  const state = body.state;
  const csrfToken = body.csrf_token;
  const requestUri = body.request_uri;
  const sessionToken = body.session_token || c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1];

  // Validate CSRF token
  if (!csrfToken || !requestUri || !validateCsrfToken(csrfToken, requestUri)) {
    return c.html(
      `<!DOCTYPE html><html><body>
        <h1>Security Error</h1>
        <p>Invalid or expired CSRF token. Please try again.</p>
        <a href="/oauth/authorize?request_uri=${encodeURIComponent(requestUri || '')}">Go back</a>
      </body></html>`,
      403,
      {
        headers: {
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
        },
      }
    );
  }

  if (action === 'deny') {
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (state) redirectUrl.searchParams.set('state', state);
    return c.redirect(redirectUrl.toString());
  }

  // Verify session
  const db = getDatabase();
  const session = db
    .prepare(
      `SELECT s.user_id, u.did FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.session_token = ? AND s.expires_at > datetime('now')`
    )
    .get(sessionToken) as { user_id: number; did: string } | undefined;

  if (!session) {
    return c.html(renderLoginPage(body));
  }

  // Generate authorization code
  const code = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MS).toISOString();

  db.prepare(
    `INSERT INTO pds_oauth_codes
     (code, user_did, client_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(code, session.did, clientId, redirectUri, scope, codeChallenge, codeChallengeMethod, expiresAt);

  // Redirect with code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  return c.redirect(redirectUrl.toString());
}

/**
 * Token endpoint - exchange code for tokens
 */
async function handleToken(c: Context): Promise<Response> {
  try {
    const body = await parseFormBody(c);
    const config = getPDSConfig();

    const grantType = body.grant_type;
    const code = body.code;
    const codeVerifier = body.code_verifier;
    const redirectUri = body.redirect_uri;
    const clientId = body.client_id;
    const refreshToken = body.refresh_token;

    const db = getDatabase();

    // DPoP is required for ATProto OAuth
    const dpopHeader = c.req.header('DPoP');
    if (!dpopHeader) {
      return c.json(
        { error: 'invalid_request', error_description: 'DPoP proof required' },
        400
      );
    }

    // Validate DPoP proof
    const dpopResult = validateDPoPProof(
      dpopHeader,
      'POST',
      `${config.publicUrl}/oauth/token`
    );
    if (!dpopResult.valid) {
      return c.json(
        { error: 'invalid_dpop_proof', error_description: dpopResult.error },
        400
      );
    }

    const dpopJkt = dpopResult.jkt!;

    if (grantType === 'authorization_code') {
      // Validate code
      const codeRow = db
        .prepare(
          `SELECT * FROM pds_oauth_codes
           WHERE code = ? AND user_did != '' AND expires_at > datetime('now')`
        )
        .get(code) as {
        user_did: string;
        client_id: string;
        redirect_uri: string;
        scope: string;
        code_challenge: string;
        code_challenge_method: string;
        dpop_jkt: string | null;
      } | undefined;

      if (!codeRow) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid or expired code' }, 400);
      }

      // Validate redirect URI
      if (codeRow.redirect_uri !== redirectUri) {
        return c.json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }, 400);
      }

      // If DPoP was used at PAR, verify JKT matches
      if (codeRow.dpop_jkt && codeRow.dpop_jkt !== dpopJkt) {
        return c.json(
          { error: 'invalid_dpop_proof', error_description: 'DPoP key mismatch with PAR request' },
          400
        );
      }

      // Validate code verifier (PKCE)
      // RFC 7636: code_verifier must be 43-128 characters
      if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid code verifier length' }, 400);
      }

      const expectedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      if (expectedChallenge !== codeRow.code_challenge) {
        return c.json({ error: 'invalid_grant', error_description: 'Code verifier mismatch' }, 400);
      }

      // Delete used code
      db.prepare('DELETE FROM pds_oauth_codes WHERE code = ?').run(code);

      // Generate JWT access token
      const accessTokenExpirySec = Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000);
      const accessToken = await generateAccessTokenJWT(
        codeRow.user_did,
        codeRow.client_id,
        codeRow.scope,
        dpopJkt,
        accessTokenExpirySec
      );

      // Generate refresh token (opaque, stored in database)
      const newRefreshToken = crypto.randomBytes(32).toString('base64url');
      const tokenId = crypto.randomBytes(16).toString('hex');

      const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

      // Store token metadata (for refresh token validation and revocation)
      db.prepare(
        `INSERT INTO pds_oauth_tokens
         (token_id, user_did, client_id, scope, access_token_hash, refresh_token_hash, dpop_jkt, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        tokenId,
        codeRow.user_did,
        codeRow.client_id,
        codeRow.scope,
        '', // JWT access tokens are self-contained, no hash needed
        hashToken(newRefreshToken),
        dpopJkt,
        refreshExpiry
      );

      return c.json({
        access_token: accessToken,
        token_type: 'DPoP',
        expires_in: accessTokenExpirySec,
        refresh_token: newRefreshToken,
        scope: codeRow.scope,
        sub: codeRow.user_did,
      });
    } else if (grantType === 'refresh_token') {
      // Find token by refresh token hash
      const tokenRow = db
        .prepare(
          `SELECT * FROM pds_oauth_tokens
           WHERE refresh_token_hash = ? AND expires_at > datetime('now')`
        )
        .get(hashToken(refreshToken || '')) as {
        token_id: string;
        dpop_jkt: string | null;
        user_did: string;
        client_id: string;
        scope: string;
      } | undefined;

      if (!tokenRow) {
        return c.json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
      }

      // Verify DPoP JKT matches the one used when token was issued
      if (tokenRow.dpop_jkt && tokenRow.dpop_jkt !== dpopJkt) {
        return c.json(
          { error: 'invalid_dpop_proof', error_description: 'DPoP key mismatch' },
          400
        );
      }

      // Generate new JWT access token
      const accessTokenExpirySec = Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000);
      const accessToken = await generateAccessTokenJWT(
        tokenRow.user_did,
        tokenRow.client_id,
        tokenRow.scope,
        dpopJkt,
        accessTokenExpirySec
      );

      // Generate new refresh token (rotation for security)
      const newRefreshToken = crypto.randomBytes(32).toString('base64url');

      const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

      // Update tokens (refresh token rotation)
      db.prepare(
        `UPDATE pds_oauth_tokens
         SET access_token_hash = '', refresh_token_hash = ?, dpop_jkt = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE token_id = ?`
      ).run(hashToken(newRefreshToken), dpopJkt, refreshExpiry, tokenRow.token_id);

      return c.json({
        access_token: accessToken,
        token_type: 'DPoP',
        expires_in: accessTokenExpirySec,
        refresh_token: newRefreshToken,
        scope: tokenRow.scope,
        sub: tokenRow.user_did,
      });
    }

    return c.json({ error: 'unsupported_grant_type' }, 400);
  } catch (error) {
    console.error('Token error:', error);
    return c.json({ error: 'server_error' }, 500);
  }
}

/**
 * Token revocation endpoint
 * Implements RFC 7009 Token Revocation with DPoP binding
 */
async function handleRevoke(c: Context): Promise<Response> {
  try {
    const body = await parseFormBody(c);
    const config = getPDSConfig();
    const token = body.token;
    const tokenTypeHint = body.token_type_hint; // Optional: 'access_token' or 'refresh_token'
    const clientId = body.client_id;

    if (!token) {
      return c.json({ error: 'invalid_request', error_description: 'Missing token parameter' }, 400);
    }

    // DPoP is required for revocation (to prove key possession)
    const dpopHeader = c.req.header('DPoP');
    if (!dpopHeader) {
      return c.json(
        { error: 'invalid_request', error_description: 'DPoP proof required for token revocation' },
        400
      );
    }

    // Validate DPoP proof
    const dpopResult = validateDPoPProof(
      dpopHeader,
      'POST',
      `${config.publicUrl}/oauth/revoke`
    );
    if (!dpopResult.valid) {
      return c.json(
        { error: 'invalid_dpop_proof', error_description: dpopResult.error },
        400
      );
    }

    const dpopJkt = dpopResult.jkt!;
    const db = getDatabase();

    // For refresh tokens, we can look up directly
    const tokenHash = hashToken(token);

    // Find the token record
    const tokenRecord = db
      .prepare(
        `SELECT token_id, dpop_jkt, client_id FROM pds_oauth_tokens
         WHERE refresh_token_hash = ?`
      )
      .get(tokenHash) as { token_id: string; dpop_jkt: string | null; client_id: string } | undefined;

    if (tokenRecord) {
      // Verify DPoP key matches the one used to obtain the token
      if (tokenRecord.dpop_jkt && tokenRecord.dpop_jkt !== dpopJkt) {
        return c.json(
          { error: 'invalid_dpop_proof', error_description: 'DPoP key does not match token binding' },
          400
        );
      }

      // Verify client_id if provided
      if (clientId && tokenRecord.client_id !== clientId) {
        return c.json(
          { error: 'invalid_client', error_description: 'Client ID does not match token' },
          400
        );
      }

      // Revoke the token
      db.prepare('DELETE FROM pds_oauth_tokens WHERE token_id = ?').run(tokenRecord.token_id);
    }

    // For JWT access tokens, we can't revoke them directly (they're stateless)
    // but we try to find any associated token record
    // Note: In a production system, you might want to maintain a token blacklist

    // Per RFC 7009, always return 200 OK even if token was not found
    // This prevents token existence disclosure
    return c.json({});
  } catch (error) {
    console.error('Revoke error:', error);
    return c.json({ error: 'server_error' }, 500);
  }
}

/**
 * Parse form body or JSON body
 */
async function parseFormBody(c: Context): Promise<Record<string, string>> {
  const contentType = c.req.header('Content-Type') || '';

  if (contentType.includes('application/json')) {
    return await c.req.json();
  }

  const text = await c.req.text();
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};

  for (const [key, value] of params) {
    result[key] = value;
  }

  return result;
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Render authorization consent page
 */
function renderAuthorizePage(
  request: AuthorizationRequest,
  publicUrl: string,
  csrfToken: string,
  requestUri: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize Application - Leaf</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #666; margin-bottom: 16px; }
    .scope { background: #f0f0f0; padding: 8px 12px; border-radius: 4px; margin: 8px 0; }
    .buttons { display: flex; gap: 12px; margin-top: 24px; }
    button { flex: 1; padding: 12px; border-radius: 6px; font-size: 16px; cursor: pointer; }
    .approve { background: #0066cc; color: white; border: none; }
    .deny { background: white; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize Application</h1>
    <p><strong>${escapeHtml(request.clientId)}</strong> wants to access your Leaf account.</p>
    <p>This will allow the application to:</p>
    <div class="scope">${escapeHtml(request.scope)}</div>
    <form method="POST">
      <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
      <input type="hidden" name="request_uri" value="${escapeHtml(requestUri)}">
      <input type="hidden" name="client_id" value="${escapeHtml(request.clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(request.redirectUri)}">
      <input type="hidden" name="scope" value="${escapeHtml(request.scope)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(request.codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(request.codeChallengeMethod)}">
      ${request.state ? `<input type="hidden" name="state" value="${escapeHtml(request.state)}">` : ''}
      <div class="buttons">
        <button type="submit" name="action" value="deny" class="deny">Deny</button>
        <button type="submit" name="action" value="approve" class="approve">Authorize</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Render login page for OAuth flow
 */
function renderLoginPage(params: Record<string, string>): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In - Leaf</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #666; margin-bottom: 16px; }
    .error { color: red; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign In Required</h1>
    <p>Please sign in to Leaf to authorize this application.</p>
    <p><a href="/login">Sign in with GitHub or Google</a></p>
  </div>
</body>
</html>`;
}

