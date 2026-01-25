/**
 * PDS Utility Functions
 * Shared utilities for PDS components
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate NSID format (e.g., com.atproto.repo.createRecord)
 * NSIDs must be: lowercase, dot-separated segments, each segment alphanumeric
 */
export function isValidNsid(nsid: string): boolean {
  if (!nsid || nsid.length > 317) {
    return false;
  }

  const segments = nsid.split('.');
  if (segments.length < 3) {
    return false;
  }

  // Each segment must be lowercase alphanumeric, starting with letter
  const segmentPattern = /^[a-z][a-z0-9]*$/;
  for (const segment of segments) {
    if (!segmentPattern.test(segment)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate collection name (must be valid NSID)
 */
export function isValidCollection(collection: string): boolean {
  return isValidNsid(collection);
}

/**
 * Validate record key format
 * Record keys: 1-512 chars, alphanumeric plus .-_:~
 */
export function isValidRkey(rkey: string): boolean {
  if (!rkey || rkey.length < 1 || rkey.length > 512) {
    return false;
  }

  // Must match ATProto record key format
  const rkeyPattern = /^[a-zA-Z0-9._:~-]+$/;
  return rkeyPattern.test(rkey);
}

/**
 * Validate handle format (ATProto handle / domain name)
 * Handles must:
 * - Be valid domain names
 * - Have at least 2 segments (name.domain)
 * - Each segment 1-63 chars
 * - Total length max 253 chars
 * - Lowercase alphanumeric and hyphens only
 * - Segments can't start or end with hyphens
 */
export function isValidHandle(handle: string): boolean {
  if (!handle || handle.length > 253) {
    return false;
  }

  // Must be lowercase
  if (handle !== handle.toLowerCase()) {
    return false;
  }

  const segments = handle.split('.');

  // Must have at least 2 segments
  if (segments.length < 2) {
    return false;
  }

  // Each segment must be valid
  const segmentPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

  for (const segment of segments) {
    // Segment length must be 1-63
    if (segment.length < 1 || segment.length > 63) {
      return false;
    }

    // Must match pattern (alphanumeric, hyphens in middle)
    if (!segmentPattern.test(segment)) {
      // Special case: single character segments are valid
      if (segment.length === 1 && /^[a-z0-9]$/.test(segment)) {
        continue;
      }
      return false;
    }
  }

  // TLD can't be all numeric
  const tld = segments[segments.length - 1];
  if (/^\d+$/.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Validate DID format
 */
export function isValidDid(did: string): boolean {
  if (!did || !did.startsWith('did:')) {
    return false;
  }

  // Basic DID pattern: did:method:identifier
  const didPattern = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/;
  return didPattern.test(did);
}
