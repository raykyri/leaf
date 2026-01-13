import { AtpAgent } from '@atproto/api';
import crypto from 'crypto';
import * as db from '../database/index.js';
import type {
  LeafletDocument,
  LinearDocumentPage,
  TextBlock,
  CanvasPage,
  CanvasBlockWithPosition,
  LocalCanvasBlock
} from '../types/leaflet.js';

const LEAFLET_DOCUMENT_COLLECTION = 'pub.leaflet.document';

// Generate a TID (Timestamp ID) for record keys
function generateTid(): string {
  // TID format: base32-sortable timestamp + random component
  // Simplified version - uses timestamp in base36 + random
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return timestamp.toString(36) + random;
}

export interface CreatePostInput {
  title: string;
  content: string; // Plain text content
  description?: string;
}

export interface CreatePostResult {
  success: boolean;
  error?: string;
  document?: db.Document;
  uri?: string;
}

export async function createPost(
  agent: AtpAgent,
  user: db.User,
  input: CreatePostInput
): Promise<CreatePostResult> {
  try {
    const rkey = generateTid();

    // Convert plain text content to Leaflet document structure
    // Split by double newlines to create paragraphs
    const paragraphs = input.content.split(/\n\n+/).filter(p => p.trim());

    // Create blocks with the correct Leaflet structure
    // Note: $type on block wrapper is optional and omitted to match official Leaflet format
    const blocks = paragraphs.map(paragraph => ({
      block: {
        $type: 'pub.leaflet.blocks.text',
        plaintext: paragraph.trim(),
        facets: []
      } as TextBlock
    }));

    // Pages need a unique id for Leaflet compatibility
    const page: LinearDocumentPage = {
      $type: 'pub.leaflet.pages.linearDocument',
      id: crypto.randomUUID(),
      blocks
    };

    const document: LeafletDocument = {
      $type: 'pub.leaflet.document',
      title: input.title,
      description: input.description,
      author: user.did,
      pages: [page],
      publishedAt: new Date().toISOString()
    };

    // Write to user's PDS
    const response = await agent.com.atproto.repo.createRecord({
      repo: user.did,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey,
      record: document as unknown as Record<string, unknown>
    });

    const uri = response.data.uri;

    // Store in local database
    const dbDocument = db.upsertDocument(
      uri,
      user.id,
      rkey,
      document.title,
      document.author,
      JSON.stringify(document.pages),
      document.description,
      document.publishedAt
    );

    console.log(`Created post ${uri} for user ${user.handle}`);

    return {
      success: true,
      document: dbDocument,
      uri
    };
  } catch (error) {
    console.error('Error creating post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create post'
    };
  }
}

export async function deletePost(
  agent: AtpAgent,
  user: db.User,
  rkey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await agent.com.atproto.repo.deleteRecord({
      repo: user.did,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey
    });

    const uri = `at://${user.did}/${LEAFLET_DOCUMENT_COLLECTION}/${rkey}`;
    db.deleteDocument(uri);

    console.log(`Deleted post ${uri} for user ${user.handle}`);

    return { success: true };
  } catch (error) {
    console.error('Error deleting post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete post'
    };
  }
}

// Convert local canvas block to ATProto canvas block format
function convertLocalBlockToATProto(block: LocalCanvasBlock): CanvasBlockWithPosition {
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
    // rotation is omitted (not supported in local editor)
  };
}

export interface PublishCanvasInput {
  canvasId: string;
}

export interface PublishCanvasResult {
  success: boolean;
  error?: string;
  document?: db.Document;
  uri?: string;
}

export async function publishCanvas(
  agent: AtpAgent,
  user: db.User,
  input: PublishCanvasInput
): Promise<PublishCanvasResult> {
  try {
    // Get the local canvas
    const canvas = db.getCanvasById(input.canvasId);
    if (!canvas) {
      return { success: false, error: 'Canvas not found' };
    }

    // Check ownership
    if (canvas.user_id !== user.id) {
      return { success: false, error: 'You do not own this canvas' };
    }

    const rkey = generateTid();
    const localBlocks: LocalCanvasBlock[] = JSON.parse(canvas.blocks);

    // Convert local blocks to ATProto canvas blocks
    const atprotoBlocks: CanvasBlockWithPosition[] = localBlocks.map(convertLocalBlockToATProto);

    // Create the canvas page
    const canvasPage: CanvasPage = {
      $type: 'pub.leaflet.pages.canvas',
      id: crypto.randomUUID(),
      blocks: atprotoBlocks
    };

    // Create the document
    const document: LeafletDocument = {
      $type: 'pub.leaflet.document',
      title: canvas.title,
      author: user.did,
      pages: [canvasPage],
      publishedAt: new Date().toISOString()
    };

    // Write to user's PDS
    const response = await agent.com.atproto.repo.createRecord({
      repo: user.did,
      collection: LEAFLET_DOCUMENT_COLLECTION,
      rkey,
      record: document as unknown as Record<string, unknown>
    });

    const uri = response.data.uri;

    // Store in local database
    const dbDocument = db.upsertDocument(
      uri,
      user.id,
      rkey,
      document.title,
      document.author,
      JSON.stringify(document.pages),
      undefined, // description
      document.publishedAt
    );

    console.log(`Published canvas ${canvas.id} as ${uri} for user ${user.handle}`);

    return {
      success: true,
      document: dbDocument,
      uri
    };
  } catch (error) {
    console.error('Error publishing canvas:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to publish canvas'
    };
  }
}
