import { AtpAgent } from '@atproto/api';
import * as db from '../database/index.js';
import type { LeafletDocument, LeafletPublication } from '../types/leaflet.js';

const LEAFLET_DOCUMENT_COLLECTION = 'pub.leaflet.document';
const LEAFLET_PUBLICATION_COLLECTION = 'pub.leaflet.publication';

export async function indexUserPDS(user: db.User, agent?: AtpAgent): Promise<{ documents: number; publications: number }> {
  console.log(`Indexing PDS for user ${user.handle} (${user.did})`);

  // Create agent if not provided
  if (!agent) {
    agent = new AtpAgent({ service: user.pds_url });
  }

  let documentsIndexed = 0;
  let publicationsIndexed = 0;

  // Index publications first
  try {
    publicationsIndexed = await indexCollection(
      agent,
      user,
      LEAFLET_PUBLICATION_COLLECTION,
      processPublication
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
      processDocument
    );
  } catch (error) {
    console.error(`Error indexing documents for ${user.handle}:`, error);
  }

  // Update last indexed timestamp
  db.updateUserLastIndexed(user.id);

  console.log(`Indexed ${documentsIndexed} documents and ${publicationsIndexed} publications for ${user.handle}`);

  return { documents: documentsIndexed, publications: publicationsIndexed };
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
