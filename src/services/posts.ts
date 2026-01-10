import { AtpAgent } from '@atproto/api';
import crypto from 'crypto';
import * as db from '../database/index.js';
import type { LeafletDocument, LinearDocumentPage, TextBlock } from '../types/leaflet.js';

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
    // Block containers need the $type: 'pub.leaflet.pages.linearDocument#block'
    const blocks = paragraphs.map(paragraph => ({
      $type: 'pub.leaflet.pages.linearDocument#block' as const,
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
