import { z } from 'zod';
import crypto from 'crypto';

// ============ Database Entity Schemas ============

export const UserSchema = z.object({
  id: z.number(),
  did: z.string(),
  handle: z.string(),
  display_name: z.string().nullable(),
  pds_url: z.string(),
  created_at: z.string(),
  last_indexed_at: z.string().nullable()
});
export type UserFromSchema = z.infer<typeof UserSchema>;

export const SessionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  session_token: z.string(),
  access_jwt: z.string().nullable(),
  refresh_jwt: z.string().nullable(),
  expires_at: z.string(),
  created_at: z.string()
});
export type SessionFromSchema = z.infer<typeof SessionSchema>;

export const DocumentSchema = z.object({
  id: z.number(),
  uri: z.string(),
  user_id: z.number(),
  publication_id: z.number().nullable(),
  rkey: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  author: z.string(),
  content: z.string(),
  published_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});
export type DocumentFromSchema = z.infer<typeof DocumentSchema>;

export const CanvasSchema = z.object({
  id: z.string(),
  user_id: z.number(),
  uri: z.string().nullable(),
  rkey: z.string().nullable(),
  title: z.string(),
  blocks: z.string(),
  width: z.number(),
  height: z.number(),
  created_at: z.string(),
  updated_at: z.string()
});
export type CanvasFromSchema = z.infer<typeof CanvasSchema>;

// ============ API Request Body Schemas ============

export const LoginRequestSchema = z.object({
  handle: z.string().min(1, 'Handle is required'),
  password: z.string().min(1, 'Password is required')
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const CreatePostRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(280),
  content: z.string().min(1, 'Content is required'),
  description: z.string().max(500).optional()
});
export type CreatePostRequest = z.infer<typeof CreatePostRequestSchema>;

export const UpdatePostRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(280),
  content: z.string().min(1, 'Content is required'),
  description: z.string().max(500).optional()
});
export type UpdatePostRequest = z.infer<typeof UpdatePostRequestSchema>;

export const UpdateProfileRequestSchema = z.object({
  displayName: z.string().max(64).optional()
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const CreateCanvasRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(128)
});
export type CreateCanvasRequest = z.infer<typeof CreateCanvasRequestSchema>;

export const UpdateCanvasRequestSchema = z.object({
  title: z.string().min(1).max(128).optional(),
  blocks: z.array(z.unknown()).optional(),
  width: z.number().min(100).max(10000).optional(),
  height: z.number().min(100).max(10000).optional()
});
export type UpdateCanvasRequest = z.infer<typeof UpdateCanvasRequestSchema>;

// ============ Leaflet Block Schemas ============

const FacetFeatureSchema = z.object({
  $type: z.string()
}).passthrough();

const FacetSchema = z.object({
  index: z.object({
    byteStart: z.number(),
    byteEnd: z.number()
  }),
  features: z.array(FacetFeatureSchema)
});

export const TextBlockSchema = z.object({
  $type: z.literal('pub.leaflet.blocks.text'),
  plaintext: z.string(),
  facets: z.array(FacetSchema).optional()
});

export const HeaderBlockSchema = z.object({
  $type: z.literal('pub.leaflet.blocks.header'),
  plaintext: z.string(),
  level: z.number().min(1).max(6).optional(),
  facets: z.array(FacetSchema).optional()
});

export const BlockSchema = z.union([
  TextBlockSchema,
  HeaderBlockSchema,
  z.object({ $type: z.string() }).passthrough()
]);

export const BlockWithAlignmentSchema = z.object({
  block: BlockSchema,
  alignment: z.enum(['left', 'center', 'right', 'justify']).optional()
});

export const LinearDocumentPageSchema = z.object({
  $type: z.literal('pub.leaflet.pages.linearDocument'),
  id: z.string(),
  blocks: z.array(BlockWithAlignmentSchema)
});

export const CanvasPageSchema = z.object({
  $type: z.literal('pub.leaflet.pages.canvas'),
  id: z.string(),
  blocks: z.array(z.unknown())
});

export const LeafletPageSchema = z.union([
  LinearDocumentPageSchema,
  CanvasPageSchema,
  z.object({ $type: z.string() }).passthrough()
]);

// ============ Validation Helpers ============

/**
 * Safely parse JSON with a zod schema.
 * Returns the parsed data or null if parsing fails.
 */
export function safeParseJson<T>(
  json: string,
  schema: z.ZodType<T>
): T | null {
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Validate and parse request body with a zod schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.errors[0];
  const errorMessage = firstError
    ? `${firstError.path.join('.')}: ${firstError.message}`
    : 'Validation failed';
  return { success: false, error: errorMessage };
}

/**
 * Check if a value matches a schema (type guard).
 */
export function is<T>(value: unknown, schema: z.ZodType<T>): value is T {
  return schema.safeParse(value).success;
}

// ============ Validation Patterns ============

// DID format validation
// did:plc identifiers are base32-encoded (lowercase a-z, digits 2-7)
// did:web identifiers are domain names (lowercase, digits, dots, hyphens)
// Neither should contain colons after the method prefix
export const didPattern = /^did:plc:[a-z2-7]{24}$|^did:web:[a-z0-9.-]+$/;
export function isValidDid(did: unknown): did is string {
  return typeof did === 'string' && didPattern.test(did) && did.length <= 2048;
}

// Rkey format validation
export const rkeyPattern = /^[a-zA-Z0-9._~-]+$/;
export function isValidRkey(rkey: unknown): rkey is string {
  return typeof rkey === 'string' && rkeyPattern.test(rkey) && rkey.length <= 512;
}

// Canvas ID format validation
export const canvasIdPattern = /^[a-f0-9]{16}$/;
export function isValidCanvasId(id: unknown): id is string {
  return typeof id === 'string' && canvasIdPattern.test(id);
}

// ============ ID Generation ============

/**
 * Generate a unique canvas ID (16 hex characters).
 */
export function generateCanvasId(): string {
  return crypto.randomBytes(8).toString('hex');
}
