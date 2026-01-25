/**
 * ATProto Validation
 *
 * Validates collection names (NSIDs) and record keys according to ATProto spec.
 */

// NSID (Namespaced Identifier) validation
// Format: reversed domain name with at least 3 segments, e.g., "app.bsky.feed.post"
// Each segment: starts with letter, alphanumeric and hyphens, no leading/trailing hyphens
const NSID_SEGMENT_REGEX = /^[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z]$/;
const NSID_MAX_LENGTH = 317; // spec limit

/**
 * Validate an NSID (collection name)
 */
export function validateNsid(nsid: string): { valid: boolean; error?: string } {
  if (!nsid || typeof nsid !== 'string') {
    return { valid: false, error: 'NSID is required' };
  }

  if (nsid.length > NSID_MAX_LENGTH) {
    return { valid: false, error: `NSID exceeds maximum length of ${NSID_MAX_LENGTH}` };
  }

  const segments = nsid.split('.');

  // Must have at least 3 segments
  if (segments.length < 3) {
    return { valid: false, error: 'NSID must have at least 3 segments' };
  }

  // Validate each segment
  for (const segment of segments) {
    if (!segment) {
      return { valid: false, error: 'NSID contains empty segment' };
    }

    if (segment.length > 63) {
      return { valid: false, error: 'NSID segment exceeds 63 characters' };
    }

    if (!NSID_SEGMENT_REGEX.test(segment)) {
      return { valid: false, error: `Invalid NSID segment: ${segment}` };
    }
  }

  // First segment must be all lowercase (domain part)
  if (segments[0] !== segments[0].toLowerCase()) {
    return { valid: false, error: 'NSID domain segment must be lowercase' };
  }

  return { valid: true };
}

// Record key (rkey) validation
// TID format: 13 base32-sortable characters
// Other formats: "self", numeric strings, or alphanumeric with limited special chars
const TID_REGEX = /^[234567abcdefghijklmnopqrstuvwxyz]{13}$/;
const RKEY_REGEX = /^[a-zA-Z0-9._:~-]{1,512}$/;
const RKEY_MAX_LENGTH = 512;

/**
 * Validate a record key
 */
export function validateRkey(rkey: string): { valid: boolean; error?: string } {
  if (!rkey || typeof rkey !== 'string') {
    return { valid: false, error: 'Record key is required' };
  }

  if (rkey.length > RKEY_MAX_LENGTH) {
    return { valid: false, error: `Record key exceeds maximum length of ${RKEY_MAX_LENGTH}` };
  }

  // Check for path traversal attempts
  if (rkey.includes('/') || rkey.includes('\\') || rkey === '.' || rkey === '..') {
    return { valid: false, error: 'Record key contains invalid characters' };
  }

  // Validate format (alphanumeric with limited special chars)
  if (!RKEY_REGEX.test(rkey)) {
    return { valid: false, error: 'Record key contains invalid characters' };
  }

  return { valid: true };
}

/**
 * Validate a TID (Timestamp Identifier)
 */
export function validateTid(tid: string): { valid: boolean; error?: string } {
  if (!tid || typeof tid !== 'string') {
    return { valid: false, error: 'TID is required' };
  }

  if (!TID_REGEX.test(tid)) {
    return { valid: false, error: 'Invalid TID format' };
  }

  return { valid: true };
}

/**
 * Validate a DID (Decentralized Identifier)
 */
export function validateDid(did: string): { valid: boolean; error?: string } {
  if (!did || typeof did !== 'string') {
    return { valid: false, error: 'DID is required' };
  }

  // Basic DID format: did:method:identifier
  if (!did.startsWith('did:')) {
    return { valid: false, error: 'DID must start with "did:"' };
  }

  const parts = did.split(':');
  if (parts.length < 3) {
    return { valid: false, error: 'Invalid DID format' };
  }

  // Validate method (plc or web for ATProto)
  const method = parts[1];
  if (method !== 'plc' && method !== 'web') {
    return { valid: false, error: 'DID method must be "plc" or "web"' };
  }

  // Validate identifier exists
  const identifier = parts.slice(2).join(':');
  if (!identifier) {
    return { valid: false, error: 'DID identifier is required' };
  }

  return { valid: true };
}

/**
 * Validate an AT URI
 * Format: at://did/collection/rkey
 */
export function validateAtUri(uri: string): { valid: boolean; error?: string; parts?: { did: string; collection: string; rkey: string } } {
  if (!uri || typeof uri !== 'string') {
    return { valid: false, error: 'AT URI is required' };
  }

  if (!uri.startsWith('at://')) {
    return { valid: false, error: 'AT URI must start with "at://"' };
  }

  const path = uri.slice(5); // Remove 'at://'
  const parts = path.split('/');

  if (parts.length < 3) {
    return { valid: false, error: 'AT URI must include DID, collection, and rkey' };
  }

  const [did, collection, ...rkeyParts] = parts;
  const rkey = rkeyParts.join('/');

  const didValidation = validateDid(did);
  if (!didValidation.valid) {
    return { valid: false, error: `Invalid DID in AT URI: ${didValidation.error}` };
  }

  const nsidValidation = validateNsid(collection);
  if (!nsidValidation.valid) {
    return { valid: false, error: `Invalid collection in AT URI: ${nsidValidation.error}` };
  }

  const rkeyValidation = validateRkey(rkey);
  if (!rkeyValidation.valid) {
    return { valid: false, error: `Invalid rkey in AT URI: ${rkeyValidation.error}` };
  }

  return { valid: true, parts: { did, collection, rkey } };
}
