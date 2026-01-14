import { AtpAgent } from '@atproto/api';
import * as db from '../database/index.js';
import type {
  LeafletCanvas,
  CanvasBlockWithPosition,
  TextBlock,
  LocalCanvasBlock
} from '../types/leaflet.js';

const LEAFLET_CANVAS_COLLECTION = 'pub.leaflet.canvas';

// Generate a TID (Timestamp ID) for record keys
function generateTid(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return timestamp.toString(36) + random;
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
  };
}

// Convert ATProto canvas block to local canvas block format
function convertATProtoBlockToLocal(block: CanvasBlockWithPosition, index: number): LocalCanvasBlock {
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

export interface SaveCanvasResult {
  success: boolean;
  error?: string;
  canvas?: db.Canvas;
  uri?: string;
}

export async function saveCanvasToATProto(
  agent: AtpAgent,
  user: db.User,
  canvas: db.Canvas
): Promise<SaveCanvasResult> {
  try {
    const localBlocks: LocalCanvasBlock[] = JSON.parse(canvas.blocks);
    const atprotoBlocks: CanvasBlockWithPosition[] = localBlocks.map(convertLocalBlockToATProto);

    const canvasRecord: LeafletCanvas = {
      $type: 'pub.leaflet.canvas',
      title: canvas.title,
      blocks: atprotoBlocks,
      width: canvas.width,
      height: canvas.height,
      createdAt: canvas.created_at
    };

    let uri: string;
    let rkey: string;

    if (canvas.uri && canvas.rkey) {
      // Update existing record
      rkey = canvas.rkey;
      await agent.com.atproto.repo.putRecord({
        repo: user.did,
        collection: LEAFLET_CANVAS_COLLECTION,
        rkey: canvas.rkey,
        record: canvasRecord as unknown as Record<string, unknown>
      });
      uri = canvas.uri;
      console.log(`Updated canvas ${canvas.id} at ${uri}`);
    } else {
      // Create new record
      rkey = generateTid();
      const response = await agent.com.atproto.repo.createRecord({
        repo: user.did,
        collection: LEAFLET_CANVAS_COLLECTION,
        rkey,
        record: canvasRecord as unknown as Record<string, unknown>
      });
      uri = response.data.uri;

      // Update local canvas with URI and rkey
      db.updateCanvasUri(canvas.id, uri, rkey);
      console.log(`Created canvas ${canvas.id} at ${uri}`);
    }

    const updatedCanvas = db.getCanvasById(canvas.id);
    return {
      success: true,
      canvas: updatedCanvas || undefined,
      uri
    };
  } catch (error) {
    console.error('Error saving canvas to ATProto:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save canvas to ATProto'
    };
  }
}

export async function deleteCanvasFromATProto(
  agent: AtpAgent,
  user: db.User,
  canvas: db.Canvas
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!canvas.rkey) {
      // Canvas was never synced to ATProto, just delete locally
      return { success: true };
    }

    await agent.com.atproto.repo.deleteRecord({
      repo: user.did,
      collection: LEAFLET_CANVAS_COLLECTION,
      rkey: canvas.rkey
    });

    console.log(`Deleted canvas ${canvas.id} from ATProto`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting canvas from ATProto:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete canvas from ATProto'
    };
  }
}

// Process incoming canvas from Jetstream or PDS indexing
export function processIncomingCanvas(
  did: string,
  rkey: string,
  record: LeafletCanvas,
  operation: 'create' | 'update' | 'delete'
): void {
  const user = db.getUserByDid(did);
  if (!user) {
    return;
  }

  const uri = `at://${did}/${LEAFLET_CANVAS_COLLECTION}/${rkey}`;

  if (operation === 'delete') {
    db.deleteCanvasByUri(uri);
    console.log(`Deleted canvas ${uri}`);
    return;
  }

  if (!record.title || !record.blocks) {
    console.warn(`Skipping invalid canvas ${uri}: missing required fields`);
    return;
  }

  // Convert ATProto blocks to local format
  const localBlocks: LocalCanvasBlock[] = record.blocks.map(convertATProtoBlockToLocal);

  db.upsertCanvas(
    uri,
    user.id,
    rkey,
    record.title,
    JSON.stringify(localBlocks),
    record.width || 1200,
    record.height || 800
  );

  console.log(`${operation === 'create' ? 'Created' : 'Updated'} canvas ${uri}`);
}

export { LEAFLET_CANVAS_COLLECTION };
