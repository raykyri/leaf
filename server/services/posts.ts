import { AtpAgent } from '@atproto/api';
import crypto from 'crypto';
import * as db from '../database/index.ts';
import type {
  LeafletDocument,
  LinearDocumentPage,
  TextBlock,
  CanvasPage,
  CanvasBlockWithPosition,
  LocalCanvasBlock
} from '../types/leaflet.ts';
import {
  LEAFLET_COLLECTIONS,
  generateTid,
  buildAtUri,
  convertLocalBlockToATProto
} from './atproto-sync.ts';

const LEAFLET_DOCUMENT_COLLECTION = LEAFLET_COLLECTIONS.DOCUMENT;

/**
 * Check if a user is a social login user (uses local PDS)
 */
function isSocialUser(user: db.User): boolean {
  const database = db.getDatabase();
  const row = database.prepare('SELECT auth_type FROM users WHERE id = ?').get(user.id) as { auth_type: string } | undefined;
  return row?.auth_type === 'social';
}

/**
 * Get signing key for social user
 */
async function getSocialUserSigningKey(userId: number) {
  const { getSocialUserSigningKey: getKey } = await import('../pds/social-auth/index.ts');
  return getKey(userId);
}

/**
 * Get repository for social user
 */
async function getSocialUserRepo(did: string) {
  const { getRepository } = await import('../pds/repo/index.ts');
  return getRepository(did);
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
  agent: AtpAgent | null,
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

    let uri: string;

    // Check if this is a social login user (uses local PDS)
    if (isSocialUser(user)) {
      // Use local PDS
      const signingKey = await getSocialUserSigningKey(user.id);
      if (!signingKey) {
        return { success: false, error: 'Failed to get signing key' };
      }

      const repo = await getSocialUserRepo(user.did);
      const result = await repo.createRecord(
        LEAFLET_DOCUMENT_COLLECTION,
        rkey,
        document,
        signingKey
      );

      uri = buildAtUri(user.did, LEAFLET_DOCUMENT_COLLECTION, rkey);
    } else {
      // Use external PDS via agent
      if (!agent) {
        return { success: false, error: 'No authenticated agent available' };
      }

      const response = await agent.com.atproto.repo.createRecord({
        repo: user.did,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey,
        record: document as unknown as Record<string, unknown>
      });

      uri = response.data.uri;
    }

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

export interface UpdatePostInput {
  title: string;
  content: string;
  description?: string;
}

export interface UpdatePostResult {
  success: boolean;
  error?: string;
  document?: db.Document;
  uri?: string;
}

export async function updatePost(
  agent: AtpAgent | null,
  user: db.User,
  rkey: string,
  input: UpdatePostInput
): Promise<UpdatePostResult> {
  try {
    // Convert plain text content to Leaflet document structure
    const paragraphs = input.content.split(/\n\n+/).filter(p => p.trim());

    const blocks = paragraphs.map(paragraph => ({
      block: {
        $type: 'pub.leaflet.blocks.text',
        plaintext: paragraph.trim(),
        facets: []
      } as TextBlock
    }));

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

    let uri: string;

    // Check if this is a social login user (uses local PDS)
    if (isSocialUser(user)) {
      // Use local PDS
      const signingKey = await getSocialUserSigningKey(user.id);
      if (!signingKey) {
        return { success: false, error: 'Failed to get signing key' };
      }

      const repo = await getSocialUserRepo(user.did);
      await repo.updateRecord(LEAFLET_DOCUMENT_COLLECTION, rkey, document, signingKey);

      uri = buildAtUri(user.did, LEAFLET_DOCUMENT_COLLECTION, rkey);
    } else {
      // Use external PDS via agent
      if (!agent) {
        return { success: false, error: 'No authenticated agent available' };
      }

      const response = await agent.com.atproto.repo.putRecord({
        repo: user.did,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey,
        record: document as unknown as Record<string, unknown>
      });

      uri = response.data.uri;
    }

    // Update in local database
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

    console.log(`Updated post ${uri} for user ${user.handle}`);

    return {
      success: true,
      document: dbDocument,
      uri
    };
  } catch (error) {
    console.error('Error updating post:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update post'
    };
  }
}

export async function deletePost(
  agent: AtpAgent | null,
  user: db.User,
  rkey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const uri = buildAtUri(user.did, LEAFLET_DOCUMENT_COLLECTION, rkey);

    // Check if this is a social login user (uses local PDS)
    if (isSocialUser(user)) {
      // Use local PDS
      const signingKey = await getSocialUserSigningKey(user.id);
      if (!signingKey) {
        return { success: false, error: 'Failed to get signing key' };
      }

      const repo = await getSocialUserRepo(user.did);
      await repo.deleteRecord(LEAFLET_DOCUMENT_COLLECTION, rkey, signingKey);
    } else {
      // Use external PDS via agent
      if (!agent) {
        return { success: false, error: 'No authenticated agent available' };
      }

      await agent.com.atproto.repo.deleteRecord({
        repo: user.did,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey
      });
    }

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
  agent: AtpAgent | null,
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

    let uri: string;

    // Check if this is a social login user (uses local PDS)
    if (isSocialUser(user)) {
      // Use local PDS
      const signingKey = await getSocialUserSigningKey(user.id);
      if (!signingKey) {
        return { success: false, error: 'Failed to get signing key' };
      }

      const repo = await getSocialUserRepo(user.did);
      await repo.createRecord(LEAFLET_DOCUMENT_COLLECTION, rkey, document, signingKey);

      uri = buildAtUri(user.did, LEAFLET_DOCUMENT_COLLECTION, rkey);
    } else {
      // Use external PDS via agent
      if (!agent) {
        return { success: false, error: 'No authenticated agent available' };
      }

      const response = await agent.com.atproto.repo.createRecord({
        repo: user.did,
        collection: LEAFLET_DOCUMENT_COLLECTION,
        rkey,
        record: document as unknown as Record<string, unknown>
      });

      uri = response.data.uri;
    }

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
