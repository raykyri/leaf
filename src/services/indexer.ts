import { AtpAgent } from '@atproto/api';
import * as db from '../database/index.js';
import crypto from 'crypto';
import type { LeafletDocument, LeafletPublication, CanvasPage, CanvasBlockWithPosition, LocalCanvasBlock } from '../types/leaflet.js';

const LEAFLET_DOCUMENT_COLLECTION = 'pub.leaflet.document';
const LEAFLET_PUBLICATION_COLLECTION = 'pub.leaflet.publication';

// Check if a document is a canvas document (has only a single CanvasPage)
function isCanvasDocument(doc: LeafletDocument): boolean {
  return doc.pages.length === 1 && doc.pages[0].$type === 'pub.leaflet.pages.canvas';
}

// Convert ATProto canvas block to local canvas block
function convertATProtoBlockToLocal(block: CanvasBlockWithPosition, index: number): LocalCanvasBlock {
  // Extract text content from the block
  let content = '';
  if (block.block.$type === 'pub.leaflet.blocks.text') {
    content = (block.block as { plaintext?: string }).plaintext || '';
  } else if ('plaintext' in block.block) {
    content = (block.block as { plaintext: string }).plaintext;
  }

  return {
    id: crypto.randomUUID(),
    type: 'text',
    content,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height || 100 // Default height if not provided
  };
}

export async function indexUserPDS(user: db.User, agent?: AtpAgent): Promise<{ documents: number; publications: number; canvases: number; deleted: number }> {
  console.log(`Indexing PDS for user ${user.handle} (${user.did})`);

  // Create agent if not provided
  if (!agent) {
    agent = new AtpAgent({ service: user.pds_url });
  }

  let documentsIndexed = 0;
  let publicationsIndexed = 0;
  let canvasesIndexed = 0;
  let deleted = 0;

  // Get existing local URIs before sync to detect orphans
  const existingDocumentUris = new Set(db.getDocumentUrisByUser(user.id));
  const existingPublicationUris = new Set(db.getPublicationUrisByUser(user.id));
  const existingCanvasUris = new Set(db.getCanvasUrisByUser(user.id));
  const seenDocumentUris = new Set<string>();
  const seenPublicationUris = new Set<string>();
  const seenCanvasUris = new Set<string>();

  // Index publications first
  try {
    publicationsIndexed = await indexCollection(
      agent,
      user,
      LEAFLET_PUBLICATION_COLLECTION,
      (user, uri, rkey, record) => {
        seenPublicationUris.add(uri);
        processPublication(user, uri, rkey, record);
      }
    );
  } catch (error) {
    console.error(`Error indexing publications for ${user.handle}:`, error);
  }

  // Index documents (which includes canvas documents)
  try {
    documentsIndexed = await indexCollection(
      agent,
      user,
      LEAFLET_DOCUMENT_COLLECTION,
      (user, uri, rkey, record) => {
        seenDocumentUris.add(uri);
        const doc = record as LeafletDocument;

        // Check if this is a canvas document
        if (isCanvasDocument(doc)) {
          seenCanvasUris.add(uri);
          canvasesIndexed++;
        }

        processDocument(user, uri, rkey, record);
      }
    );
  } catch (error) {
    console.error(`Error indexing documents for ${user.handle}:`, error);
  }

  // Delete orphaned documents (exist locally but not on PDS)
  for (const uri of existingDocumentUris) {
    if (!seenDocumentUris.has(uri)) {
      db.deleteDocument(uri);
      deleted++;
      console.log(`Deleted orphaned document: ${uri}`);
    }
  }

  // Delete orphaned publications
  for (const uri of existingPublicationUris) {
    if (!seenPublicationUris.has(uri)) {
      db.deletePublication(uri);
      deleted++;
      console.log(`Deleted orphaned publication: ${uri}`);
    }
  }

  // Delete orphaned canvases (synced canvases that no longer exist on PDS)
  for (const uri of existingCanvasUris) {
    if (!seenCanvasUris.has(uri)) {
      db.deleteCanvasByUri(uri);
      deleted++;
      console.log(`Deleted orphaned canvas: ${uri}`);
    }
  }

  // Update last indexed timestamp
  db.updateUserLastIndexed(user.id);

  console.log(`Indexed ${documentsIndexed} documents (${canvasesIndexed} canvases) and ${publicationsIndexed} publications for ${user.handle} (deleted ${deleted} orphans)`);

  return { documents: documentsIndexed, publications: publicationsIndexed, canvases: canvasesIndexed, deleted };
}

type RecordProcessor = (user: db.User, uri: string, rkey: string, record: unknown) => void;

async function indexCollection(
  agent: AtpAgent,
  user: db.User,
  collection: string,
  processor: RecordProcessor
): Promise<number> {
  let cursor: string | undefined;
  let count = 0;

  do {
    try {
      const response = await agent.com.atproto.repo.listRecords({
        repo: user.did,
        collection,
        limit: 100,
        cursor
      });

      for (const record of response.data.records) {
        try {
          processor(user, record.uri, record.uri.split('/').pop()!, record.value);
          count++;
        } catch (error) {
          console.error(`Error processing record ${record.uri}:`, error);
        }
      }

      cursor = response.data.cursor;
    } catch (error: unknown) {
      // Collection might not exist for this user, that's okay
      if (error && typeof error === 'object' && 'status' in error && error.status === 400) {
        break;
      }
      throw error;
    }
  } while (cursor);

  return count;
}

function processDocument(user: db.User, uri: string, rkey: string, record: unknown): void {
  const doc = record as LeafletDocument;

  if (!doc.title || !doc.pages) {
    console.warn(`Skipping invalid document ${uri}: missing required fields`);
    return;
  }

  // Check if this is a canvas document and sync to canvases table
  if (isCanvasDocument(doc)) {
    processIncomingCanvas(user, uri, rkey, doc);
  }

  db.upsertDocument(
    uri,
    user.id,
    rkey,
    doc.title,
    doc.author || user.did,
    JSON.stringify(doc.pages),
    doc.description,
    doc.publishedAt
  );
}

function processPublication(user: db.User, uri: string, rkey: string, record: unknown): void {
  const pub = record as LeafletPublication;

  if (!pub.name) {
    console.warn(`Skipping invalid publication ${uri}: missing name`);
    return;
  }

  db.upsertPublication(
    uri,
    user.id,
    rkey,
    pub.name,
    pub.description,
    pub.base_path
  );
}

// Process a single document from Jetstream or other sources
export function processIncomingDocument(
  did: string,
  rkey: string,
  record: LeafletDocument,
  operation: 'create' | 'update' | 'delete'
): void {
  const user = db.getUserByDid(did);
  if (!user) {
    // User not registered, ignore
    return;
  }

  const uri = `at://${did}/${LEAFLET_DOCUMENT_COLLECTION}/${rkey}`;

  if (operation === 'delete') {
    // Check if this is a canvas document and delete the canvas too
    const existingCanvas = db.getCanvasByUri(uri);
    if (existingCanvas) {
      db.deleteCanvasByUri(uri);
      console.log(`Deleted canvas ${existingCanvas.id} (from ATProto ${uri})`);
    }
    db.deleteDocument(uri);
    console.log(`Deleted document ${uri}`);
    return;
  }

  if (!record.title || !record.pages) {
    console.warn(`Skipping invalid document ${uri}: missing required fields`);
    return;
  }

  // Check if this is a canvas document
  if (isCanvasDocument(record)) {
    processIncomingCanvas(user, uri, rkey, record);
  }

  // Also store as a regular document for compatibility
  db.upsertDocument(
    uri,
    user.id,
    rkey,
    record.title,
    record.author || did,
    JSON.stringify(record.pages),
    record.description,
    record.publishedAt
  );

  console.log(`${operation === 'create' ? 'Created' : 'Updated'} document ${uri}`);
}

// Process an incoming canvas document from ATProto
function processIncomingCanvas(
  user: db.User,
  uri: string,
  rkey: string,
  record: LeafletDocument
): void {
  const canvasPage = record.pages[0] as CanvasPage;

  // Check if we already have this canvas locally
  const existingCanvas = db.getCanvasByUri(uri);

  // Convert ATProto blocks to local blocks
  const localBlocks: LocalCanvasBlock[] = canvasPage.blocks.map((block, index) =>
    convertATProtoBlockToLocal(block, index)
  );

  // Calculate canvas dimensions from block positions
  let width = 1200;
  let height = 800;
  for (const block of canvasPage.blocks) {
    const blockRight = block.x + block.width;
    const blockBottom = block.y + (block.height || 100);
    if (blockRight > width) width = Math.min(blockRight + 100, 10000);
    if (blockBottom > height) height = Math.min(blockBottom + 100, 10000);
  }

  if (existingCanvas) {
    // Update existing canvas
    db.updateCanvas(existingCanvas.id, {
      title: record.title,
      blocks: JSON.stringify(localBlocks),
      width,
      height
    });
    console.log(`Updated canvas ${existingCanvas.id} from ATProto ${uri}`);
  } else {
    // Create new canvas
    // Use the page id if available, otherwise generate a new one
    const canvasId = canvasPage.id || crypto.randomBytes(8).toString('hex');
    db.upsertCanvasFromATProto(
      canvasId,
      user.id,
      uri,
      rkey,
      record.title,
      JSON.stringify(localBlocks),
      width,
      height
    );
    console.log(`Created canvas ${canvasId} from ATProto ${uri}`);
  }
}

// Process a single publication from Jetstream
export function processIncomingPublication(
  did: string,
  rkey: string,
  record: LeafletPublication,
  operation: 'create' | 'update' | 'delete'
): void {
  const user = db.getUserByDid(did);
  if (!user) {
    return;
  }

  const uri = `at://${did}/${LEAFLET_PUBLICATION_COLLECTION}/${rkey}`;

  if (operation === 'delete') {
    db.deletePublication(uri);
    console.log(`Deleted publication ${uri}`);
    return;
  }

  if (!record.name) {
    console.warn(`Skipping invalid publication ${uri}: missing name`);
    return;
  }

  db.upsertPublication(
    uri,
    user.id,
    rkey,
    record.name,
    record.description,
    record.base_path
  );

  console.log(`${operation === 'create' ? 'Created' : 'Updated'} publication ${uri}`);
}
