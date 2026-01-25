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

/**
 * Validate AT URI format
 * Format: at://did/collection/rkey
 */
export function isValidAtUri(uri: string): boolean {
  if (!uri || !uri.startsWith('at://')) {
    return false;
  }

  const parts = uri.slice(5).split('/');
  if (parts.length < 2 || parts.length > 3) {
    return false;
  }

  const [authority, collection, rkey] = parts;

  // Authority must be a valid DID or handle
  if (!isValidDid(authority) && !isValidHandle(authority)) {
    return false;
  }

  // Collection must be a valid NSID
  if (!isValidCollection(collection)) {
    return false;
  }

  // Rkey is optional, but if present must be valid
  if (rkey !== undefined && rkey !== '' && !isValidRkey(rkey)) {
    return false;
  }

  return true;
}

/**
 * Validate CID format (Content Identifier)
 */
export function isValidCid(cid: string): boolean {
  if (!cid || cid.length < 8 || cid.length > 128) {
    return false;
  }

  // CIDv1 starts with 'b' (base32) or 'z' (base58btc) or 'f' (base16)
  // CIDv0 starts with 'Qm'
  const cidPattern = /^(Qm[1-9A-HJ-NP-Za-km-z]{44,46}|b[a-z2-7]{58,}|z[1-9A-HJ-NP-Za-km-z]{48,}|f[0-9a-f]+)$/;
  return cidPattern.test(cid);
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Known Lexicon type definitions for common ATProto records
 * This is a simplified validation - full validation would use the complete Lexicon schemas
 */
const KNOWN_SCHEMAS: Record<string, {
  required?: string[];
  optional?: string[];
  types?: Record<string, string | string[]>;
  maxStringLength?: Record<string, number>;
  maxArrayLength?: Record<string, number>;
}> = {
  'app.bsky.feed.post': {
    required: ['text', 'createdAt'],
    optional: ['reply', 'embed', 'langs', 'labels', 'tags', 'facets'],
    types: {
      text: 'string',
      createdAt: 'datetime',
      langs: 'array',
      tags: 'array',
      facets: 'array',
    },
    maxStringLength: {
      text: 3000,
    },
    maxArrayLength: {
      langs: 3,
      tags: 8,
    },
  },
  'app.bsky.feed.like': {
    required: ['subject', 'createdAt'],
    types: {
      createdAt: 'datetime',
    },
  },
  'app.bsky.feed.repost': {
    required: ['subject', 'createdAt'],
    types: {
      createdAt: 'datetime',
    },
  },
  'app.bsky.graph.follow': {
    required: ['subject', 'createdAt'],
    types: {
      subject: 'did',
      createdAt: 'datetime',
    },
  },
  'app.bsky.graph.block': {
    required: ['subject', 'createdAt'],
    types: {
      subject: 'did',
      createdAt: 'datetime',
    },
  },
  'app.bsky.actor.profile': {
    optional: ['displayName', 'description', 'avatar', 'banner', 'labels'],
    types: {
      displayName: 'string',
      description: 'string',
    },
    maxStringLength: {
      displayName: 640,
      description: 2560,
    },
  },
  'app.bsky.graph.list': {
    required: ['purpose', 'name', 'createdAt'],
    optional: ['description', 'descriptionFacets', 'avatar', 'labels'],
    types: {
      name: 'string',
      description: 'string',
      createdAt: 'datetime',
    },
    maxStringLength: {
      name: 64,
      description: 3000,
    },
  },
  'app.bsky.graph.listitem': {
    required: ['subject', 'list', 'createdAt'],
    types: {
      subject: 'did',
      list: 'at-uri',
      createdAt: 'datetime',
    },
  },
};

/**
 * Validate a record against its schema
 * @param record The record to validate
 * @param collection The collection (NSID) the record is being stored in
 * @param options Validation options
 */
export function validateRecordSchema(
  record: unknown,
  collection: string,
  options: { strict?: boolean } = {}
): SchemaValidationResult {
  const errors: string[] = [];

  // Record must be an object
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: ['Record must be a non-null object'] };
  }

  const rec = record as Record<string, unknown>;

  // Check $type field
  if (!rec.$type) {
    errors.push('Record must have a $type field');
  } else if (typeof rec.$type !== 'string') {
    errors.push('$type must be a string');
  } else if (rec.$type !== collection) {
    errors.push(`$type "${rec.$type}" does not match collection "${collection}"`);
  }

  // Validate record size (rough check - actual limit varies by type)
  const recordJson = JSON.stringify(record);
  if (recordJson.length > 1000000) { // 1MB limit
    errors.push('Record exceeds maximum size of 1MB');
  }

  // Get schema if available
  const schema = KNOWN_SCHEMAS[collection];

  if (schema) {
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (rec[field] === undefined) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Validate field types
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        const value = rec[field];
        if (value === undefined) continue;

        const typeError = validateFieldType(field, value, expectedType);
        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    // Check string length limits
    if (schema.maxStringLength) {
      for (const [field, maxLength] of Object.entries(schema.maxStringLength)) {
        const value = rec[field];
        if (typeof value === 'string' && value.length > maxLength) {
          errors.push(`Field "${field}" exceeds maximum length of ${maxLength} characters`);
        }
      }
    }

    // Check array length limits
    if (schema.maxArrayLength) {
      for (const [field, maxLength] of Object.entries(schema.maxArrayLength)) {
        const value = rec[field];
        if (Array.isArray(value) && value.length > maxLength) {
          errors.push(`Field "${field}" exceeds maximum length of ${maxLength} items`);
        }
      }
    }

    // In strict mode, check for unknown fields
    if (options.strict) {
      const allowedFields = new Set([
        '$type',
        ...(schema.required || []),
        ...(schema.optional || []),
      ]);
      for (const field of Object.keys(rec)) {
        if (!allowedFields.has(field)) {
          errors.push(`Unknown field: ${field}`);
        }
      }
    }
  }

  // Validate nested structures
  validateNestedStructures(rec, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a field against its expected type
 */
function validateFieldType(field: string, value: unknown, expectedType: string | string[]): string | null {
  const types = Array.isArray(expectedType) ? expectedType : [expectedType];

  for (const type of types) {
    switch (type) {
      case 'string':
        if (typeof value === 'string') return null;
        break;
      case 'number':
      case 'integer':
        if (typeof value === 'number') return null;
        break;
      case 'boolean':
        if (typeof value === 'boolean') return null;
        break;
      case 'array':
        if (Array.isArray(value)) return null;
        break;
      case 'object':
        if (value && typeof value === 'object' && !Array.isArray(value)) return null;
        break;
      case 'datetime':
        if (typeof value === 'string' && isValidDatetime(value)) return null;
        break;
      case 'did':
        if (typeof value === 'string' && isValidDid(value)) return null;
        break;
      case 'at-uri':
        if (typeof value === 'string' && isValidAtUri(value)) return null;
        break;
      case 'cid':
        if (typeof value === 'string' && isValidCid(value)) return null;
        break;
    }
  }

  return `Field "${field}" has invalid type. Expected: ${types.join(' | ')}`;
}

/**
 * Validate datetime string format (ISO 8601)
 */
function isValidDatetime(value: string): boolean {
  // Basic ISO 8601 pattern
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
  if (!isoPattern.test(value)) {
    return false;
  }

  // Verify it's a valid date
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Validate nested structures like blob refs, strong refs, etc.
 */
function validateNestedStructures(obj: Record<string, unknown>, errors: string[], path: string = ''): void {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;

      // Check for blob reference
      if (nested.$type === 'blob') {
        validateBlobRef(nested, currentPath, errors);
      }

      // Check for strong reference (subject in likes, reposts, etc.)
      if (nested.uri !== undefined && nested.cid !== undefined) {
        validateStrongRef(nested, currentPath, errors);
      }

      // Recurse into nested objects
      validateNestedStructures(nested, errors, currentPath);
    } else if (Array.isArray(value)) {
      // Recurse into arrays
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item && typeof item === 'object') {
          validateNestedStructures(item as Record<string, unknown>, errors, `${currentPath}[${i}]`);
        }
      }
    }
  }
}

/**
 * Validate blob reference structure
 */
function validateBlobRef(blob: Record<string, unknown>, path: string, errors: string[]): void {
  const ref = blob.ref as Record<string, unknown> | undefined;

  if (!ref) {
    errors.push(`${path}: Blob reference missing 'ref' field`);
    return;
  }

  if (typeof ref.$link !== 'string') {
    errors.push(`${path}: Blob reference missing '$link' in 'ref'`);
  } else if (!isValidCid(ref.$link)) {
    errors.push(`${path}: Invalid CID in blob reference`);
  }

  if (blob.mimeType !== undefined && typeof blob.mimeType !== 'string') {
    errors.push(`${path}: Blob 'mimeType' must be a string`);
  }

  if (blob.size !== undefined && typeof blob.size !== 'number') {
    errors.push(`${path}: Blob 'size' must be a number`);
  }
}

/**
 * Validate strong reference (uri + cid pair)
 */
function validateStrongRef(ref: Record<string, unknown>, path: string, errors: string[]): void {
  if (typeof ref.uri !== 'string') {
    errors.push(`${path}: Strong reference 'uri' must be a string`);
  } else if (!isValidAtUri(ref.uri)) {
    errors.push(`${path}: Invalid AT URI in strong reference`);
  }

  if (typeof ref.cid !== 'string') {
    errors.push(`${path}: Strong reference 'cid' must be a string`);
  } else if (!isValidCid(ref.cid)) {
    errors.push(`${path}: Invalid CID in strong reference`);
  }
}
