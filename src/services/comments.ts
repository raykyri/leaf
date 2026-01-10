import { AtpAgent } from '@atproto/api';
import type { LeafletComment, CommentReplyRef, Facet } from '../types/leaflet.js';

const LEAFLET_COMMENT_COLLECTION = 'pub.leaflet.comment';

// Generate a TID (Timestamp ID) for record keys
function generateTid(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return timestamp.toString(36) + random;
}

export interface CreateCommentInput {
  subject: string; // AT-URI of the document being commented on
  plaintext: string;
  reply?: CommentReplyRef; // For threading - reference to parent comment
  facets?: Facet[];
  onPage?: string; // Page ID within document
}

export interface CreateCommentResult {
  success: boolean;
  error?: string;
  uri?: string;
  comment?: LeafletComment;
}

export async function createComment(
  agent: AtpAgent,
  userDid: string,
  input: CreateCommentInput
): Promise<CreateCommentResult> {
  try {
    const rkey = generateTid();

    const comment: LeafletComment = {
      $type: 'pub.leaflet.comment',
      subject: input.subject,
      plaintext: input.plaintext,
      createdAt: new Date().toISOString(),
      ...(input.reply && { reply: input.reply }),
      ...(input.facets && { facets: input.facets }),
      ...(input.onPage && { onPage: input.onPage })
    };

    const response = await agent.com.atproto.repo.createRecord({
      repo: userDid,
      collection: LEAFLET_COMMENT_COLLECTION,
      rkey,
      record: comment as unknown as Record<string, unknown>
    });

    const uri = response.data.uri;

    console.log(`Created comment ${uri} on ${input.subject}`);

    return {
      success: true,
      uri,
      comment
    };
  } catch (error) {
    console.error('Error creating comment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create comment'
    };
  }
}

export async function deleteComment(
  agent: AtpAgent,
  userDid: string,
  rkey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await agent.com.atproto.repo.deleteRecord({
      repo: userDid,
      collection: LEAFLET_COMMENT_COLLECTION,
      rkey
    });

    const uri = `at://${userDid}/${LEAFLET_COMMENT_COLLECTION}/${rkey}`;
    console.log(`Deleted comment ${uri}`);

    return { success: true };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete comment'
    };
  }
}

// Helper to extract rkey from AT-URI
export function extractRkeyFromUri(uri: string): string | null {
  const parts = uri.split('/');
  return parts.length > 0 ? parts[parts.length - 1] : null;
}
