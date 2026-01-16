/**
 * Shared ATProto sync utilities
 *
 * This module contains common constants, utilities, and conversion functions
 * used across canvas, document, and publication sync operations.
 */

import type {
  CanvasBlockWithPosition,
  TextBlock,
  LocalCanvasBlock
} from '../types/leaflet.ts';

// =============================================================================
// Collection Constants
// =============================================================================

export const LEAFLET_COLLECTIONS = {
  CANVAS: 'pub.leaflet.canvas',
  DOCUMENT: 'pub.leaflet.document',
  PUBLICATION: 'pub.leaflet.publication'
} as const;

export type LeafletCollection = typeof LEAFLET_COLLECTIONS[keyof typeof LEAFLET_COLLECTIONS];

// Array of all collections (for Jetstream subscription)
export const ALL_LEAFLET_COLLECTIONS: LeafletCollection[] = [
  LEAFLET_COLLECTIONS.DOCUMENT,
  LEAFLET_COLLECTIONS.PUBLICATION,
  LEAFLET_COLLECTIONS.CANVAS
];

// =============================================================================
// TID Generation
// =============================================================================

/**
 * Generate a TID (Timestamp ID) for ATProto record keys.
 * TID format: base36 timestamp + random component for uniqueness.
 */
export function generateTid(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return timestamp.toString(36) + random;
}

// =============================================================================
// URI Utilities
// =============================================================================

/**
 * Build an AT Protocol URI from components.
 */
export function buildAtUri(did: string, collection: string, rkey: string): string {
  return `at://${did}/${collection}/${rkey}`;
}

/**
 * Parse an AT Protocol URI into its components.
 */
export function parseAtUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    did: match[1],
    collection: match[2],
    rkey: match[3]
  };
}

// =============================================================================
// Block Conversion Utilities
// =============================================================================

/**
 * Convert a local canvas block to ATProto canvas block format.
 * Used when saving canvases to ATProto.
 */
export function convertLocalBlockToATProto(block: LocalCanvasBlock): CanvasBlockWithPosition {
  return {
    block: {
      $type: 'pub.leaflet.blocks.text',
      plaintext: block.content,
      facets: []
    } as TextBlock,
    x: Math.round(block.x),
    y: Math.round(block.y),
    width: Math.round(block.width),
    height: Math.round(block.height)
  };
}

/**
 * Convert an ATProto canvas block to local canvas block format.
 * Used when receiving canvases from ATProto.
 */
export function convertATProtoBlockToLocal(block: CanvasBlockWithPosition, index: number): LocalCanvasBlock {
  const textBlock = block.block as TextBlock;
  return {
    id: `block-${index}-${Date.now()}`,
    type: 'text',
    content: textBlock.plaintext || '',
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height || 100
  };
}
