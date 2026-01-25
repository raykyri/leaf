/**
 * Handle Management
 *
 * Manages ATProto handles for PDS accounts.
 * Handles are in the format: username.domain (e.g., alice.leaf.pub)
 */

import { getPdsConfig } from '../config.ts';
import { getPdsAccountByHandle, getPdsAccountByDid } from '../database/queries.ts';

// Valid handle characters (subset of DNS)
const HANDLE_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const MAX_HANDLE_SEGMENT_LENGTH = 63;
const MAX_HANDLE_LENGTH = 253;

export interface HandleValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate a handle format
 */
export function validateHandle(handle: string): HandleValidation {
  // Check total length
  if (handle.length > MAX_HANDLE_LENGTH) {
    return { valid: false, error: 'Handle is too long' };
  }

  // Split into segments
  const segments = handle.split('.');

  // Must have at least 2 segments (username.domain)
  if (segments.length < 2) {
    return { valid: false, error: 'Handle must have at least two parts (e.g., user.domain)' };
  }

  // Validate each segment
  for (const segment of segments) {
    if (segment.length === 0) {
      return { valid: false, error: 'Handle contains empty segment' };
    }

    if (segment.length > MAX_HANDLE_SEGMENT_LENGTH) {
      return { valid: false, error: 'Handle segment is too long' };
    }

    if (!HANDLE_REGEX.test(segment)) {
      return { valid: false, error: 'Handle contains invalid characters' };
    }
  }

  // Check for reserved handles
  const username = segments[0].toLowerCase();
  if (isReservedHandle(username)) {
    return { valid: false, error: 'This handle is reserved' };
  }

  return { valid: true };
}

/**
 * Check if a handle username is reserved
 */
function isReservedHandle(username: string): boolean {
  const reserved = [
    // System accounts
    'admin', 'administrator', 'root', 'system', 'mod', 'moderator',
    'support', 'help', 'info', 'contact', 'abuse', 'postmaster',
    'webmaster', 'hostmaster', 'security', 'noreply', 'no-reply',

    // Common service names
    'api', 'www', 'mail', 'email', 'ftp', 'smtp', 'imap', 'pop',
    'dns', 'ns', 'ns1', 'ns2', 'cdn', 'static', 'assets', 'media',

    // ATProto/Bluesky related
    'atproto', 'bsky', 'bluesky', 'pds', 'relay', 'appview',
    'feed', 'labeler', 'plc', 'did', 'handle',

    // Leaf related
    'leaf', 'leaflet', 'document', 'publication', 'canvas',

    // Offensive or confusing
    'null', 'undefined', 'void', 'anonymous', 'everyone', 'all',
    'here', 'channel', 'group', 'team',
  ];

  return reserved.includes(username);
}

/**
 * Check if a handle is available for registration
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  // First validate the format
  const validation = validateHandle(handle);
  if (!validation.valid) {
    return false;
  }

  // Check if it's already registered in our PDS
  const existing = getPdsAccountByHandle(handle);
  if (existing) {
    return false;
  }

  return true;
}

/**
 * Resolve a handle to a DID
 */
export function resolveHandle(handle: string): string | null {
  const config = getPdsConfig();

  // Normalize handle
  const normalizedHandle = handle.toLowerCase();

  // Check if this is a handle on our domain
  if (normalizedHandle.endsWith(`.${config.handleDomain}`)) {
    const account = getPdsAccountByHandle(normalizedHandle);
    if (account) {
      return account.did;
    }
  }

  return null;
}

/**
 * Get the handle for a DID
 */
export function getHandleForDid(did: string): string | null {
  const account = getPdsAccountByDid(did);
  if (account) {
    return account.handle;
  }
  return null;
}

/**
 * Check if a handle belongs to our PDS
 */
export function isLocalHandle(handle: string): boolean {
  const config = getPdsConfig();
  return handle.toLowerCase().endsWith(`.${config.handleDomain}`);
}

/**
 * Generate a handle from a base username
 */
export function generateHandle(username: string): string {
  const config = getPdsConfig();

  // Sanitize username
  let sanitized = username.toLowerCase();

  // Replace invalid characters with dashes
  sanitized = sanitized.replace(/[^a-z0-9-]/g, '-');

  // Remove leading/trailing dashes
  sanitized = sanitized.replace(/^-+|-+$/g, '');

  // Collapse multiple dashes
  sanitized = sanitized.replace(/-+/g, '-');

  // Ensure minimum length
  if (sanitized.length < 1) {
    sanitized = 'user';
  }

  // Truncate if too long
  if (sanitized.length > 20) {
    sanitized = sanitized.slice(0, 20);
  }

  // Remove trailing dash after truncation
  sanitized = sanitized.replace(/-+$/, '');

  return `${sanitized}.${config.handleDomain}`;
}

/**
 * Generate a unique handle, adding a suffix if needed
 */
export async function generateUniqueHandle(username: string): Promise<string> {
  const baseHandle = generateHandle(username);
  let handle = baseHandle;
  let suffix = 0;

  while (!(await isHandleAvailable(handle))) {
    suffix++;
    const parts = baseHandle.split('.');
    const base = parts[0];
    const domain = parts.slice(1).join('.');
    handle = `${base}${suffix}.${domain}`;

    // Safety limit
    if (suffix > 1000) {
      throw new Error('Could not generate unique handle');
    }
  }

  return handle;
}

/**
 * Serve the .well-known/atproto-did response for a handle
 */
export function serveAtprotoDid(handle: string): string | null {
  const did = resolveHandle(handle);
  return did;
}

/**
 * Resolve an external handle via well-known protocol
 * This is used to verify handles from other PDSs
 */
export async function resolveExternalHandle(handle: string): Promise<string | null> {
  try {
    // First try HTTPS
    const httpsResponse = await fetch(`https://${handle}/.well-known/atproto-did`, {
      method: 'GET',
      headers: { 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (httpsResponse.ok) {
      const did = await httpsResponse.text();
      if (did && did.startsWith('did:')) {
        return did.trim();
      }
    }

    return null;
  } catch (error) {
    // Try HTTP fallback for development
    if (process.env.NODE_ENV !== 'production') {
      try {
        const httpResponse = await fetch(`http://${handle}/.well-known/atproto-did`, {
          method: 'GET',
          headers: { 'Accept': 'text/plain' },
          signal: AbortSignal.timeout(5000),
        });

        if (httpResponse.ok) {
          const did = await httpResponse.text();
          if (did && did.startsWith('did:')) {
            return did.trim();
          }
        }
      } catch {
        // Ignore HTTP fallback errors
      }
    }

    return null;
  }
}

/**
 * Resolve a handle using DNS TXT record
 * Alternative method per ATProto spec
 */
export async function resolveHandleViaDns(handle: string): Promise<string | null> {
  // DNS resolution is typically done server-side
  // This would require a DNS library - for now, return null
  // In production, you would query _atproto.{handle} TXT record
  return null;
}

/**
 * Resolve any handle (local or external)
 */
export async function resolveAnyHandle(handle: string): Promise<string | null> {
  // First check local handles
  if (isLocalHandle(handle)) {
    const did = resolveHandle(handle);
    if (did) return did;
  }

  // Try external resolution via well-known
  const externalDid = await resolveExternalHandle(handle);
  if (externalDid) return externalDid;

  // Try DNS resolution as fallback
  const dnsDid = await resolveHandleViaDns(handle);
  if (dnsDid) return dnsDid;

  return null;
}

/**
 * Verify that a DID's handle resolves back to the DID
 * This is important for verifying handle ownership
 */
export async function verifyHandleResolution(handle: string, expectedDid: string): Promise<boolean> {
  const resolvedDid = await resolveAnyHandle(handle);
  return resolvedDid === expectedDid;
}
