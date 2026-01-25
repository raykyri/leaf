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
