import { AtpAgent } from '@atproto/api';
import * as db from '../database/index.ts';
import type { LeafletDocument, LeafletPublication, LeafletCanvas, CanvasBlockWithPosition, LocalCanvasBlock, TextBlock } from '../types/leaflet.ts';

const LEAFLET_DOCUMENT_COLLECTION = 'pub.leaflet.document';
const LEAFLET_PUBLICATION_COLLECTION = 'pub.leaflet.publication';
const LEAFLET_CANVAS_COLLECTION = 'pub.leaflet.canvas';

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

  // Index documents
  try {
    documentsIndexed = await indexCollection(
      agent,
      user,
      LEAFLET_DOCUMENT_COLLECTION,
      (user, uri, rkey, record) => {
        seenDocumentUris.add(uri);
        processDocument(user, uri, rkey, record);
      }
    );
  } catch (error) {
    console.error(`Error indexing documents for ${user.handle}:`, error);
  }

  // Index canvases
  try {
    canvasesIndexed = await indexCollection(
      agent,
      user,
      LEAFLET_CANVAS_COLLECTION,
      (user, uri, rkey, record) => {
        seenCanvasUris.add(uri);
        processCanvas(user, uri, rkey, record);
      }
    );
  } catch (error) {
    console.error(`Error indexing canvases for ${user.handle}:`, error);
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

  // Delete orphaned canvases
  for (const uri of existingCanvasUris) {
    if (!seenCanvasUris.has(uri)) {
      db.deleteCanvasByUri(uri);
      deleted++;
      console.log(`Deleted orphaned canvas: ${uri}`);
    }
  }

  // Update last indexed timestamp
  db.updateUserLastIndexed(user.id);

  console.log(`Indexed ${documentsIndexed} documents, ${publicationsIndexed} publications, and ${canvasesIndexed} canvases for ${user.handle} (deleted ${deleted} orphans)`);

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

function processCanvas(user: db.User, uri: string, rkey: string, record: unknown): void {
  const canvas = record as LeafletCanvas;

  if (!canvas.title || !canvas.blocks) {
    console.warn(`Skipping invalid canvas ${uri}: missing required fields`);
    return;
  }

  // Convert ATProto blocks to local format
  const localBlocks: LocalCanvasBlock[] = canvas.blocks.map(convertATProtoBlockToLocal);

  db.upsertCanvas(
    uri,
    user.id,
    rkey,
    canvas.title,
    JSON.stringify(localBlocks),
    canvas.width || 1200,
    canvas.height || 800
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
    db.deleteDocument(uri);
    console.log(`Deleted document ${uri}`);
    return;
  }

  if (!record.title || !record.pages) {
    console.warn(`Skipping invalid document ${uri}: missing required fields`);
    return;
  }

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
