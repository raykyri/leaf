import WebSocket from 'ws';
import * as db from '../database/index.ts';
import { processIncomingDocument, processIncomingPublication } from './indexer.ts';
import { processIncomingCanvas } from './canvas.ts';
import type { JetstreamEvent, LeafletDocument, LeafletPublication, LeafletCanvas } from '../types/leaflet.ts';

const LEAFLET_COLLECTIONS = [
  'pub.leaflet.document',
  'pub.leaflet.publication',
  'pub.leaflet.canvas'
];

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

// Cursor persistence
let lastCursor: string | null = null;
let cursorSaveInterval: ReturnType<typeof setInterval> | null = null;
const CURSOR_SAVE_INTERVAL = 5000; // Save cursor every 5 seconds

// Cache of registered user DIDs to avoid DB query on every event
let registeredDidsCache: Set<string> = new Set();
let lastCacheRefresh = 0;
const CACHE_TTL = 60000; // Refresh cache every 60 seconds

function getRegisteredDids(): Set<string> {
  const now = Date.now();
  if (now - lastCacheRefresh > CACHE_TTL) {
    registeredDidsCache = new Set(db.getAllUserDids());
    lastCacheRefresh = now;
  }
  return registeredDidsCache;
}

// Call this when a new user registers to update the cache immediately
export function addRegisteredDid(did: string): void {
  registeredDidsCache.add(did);
}

export function startJetstreamListener(): void {
  const jetstreamUrl = process.env.JETSTREAM_URL || 'wss://jetstream2.us-east.bsky.network/subscribe';

  // Build URL with wanted collections
  const url = new URL(jetstreamUrl);
  for (const collection of LEAFLET_COLLECTIONS) {
    url.searchParams.append('wantedCollections', collection);
  }

  // Load cursor from database for resumption
  const savedCursor = db.getJetstreamCursor();
  if (savedCursor) {
    url.searchParams.set('cursor', savedCursor);
    console.log(`Resuming Jetstream from cursor: ${savedCursor}`);
  }

  console.log(`Connecting to Jetstream at ${url.toString()}`);

  ws = new WebSocket(url.toString());

  ws.on('open', () => {
    console.log('Connected to Jetstream');
    reconnectAttempts = 0;

    // Start periodic cursor saving
    if (!cursorSaveInterval) {
      cursorSaveInterval = setInterval(saveCursor, CURSOR_SAVE_INTERVAL);
    }
  });

  ws.on('message', (data: Buffer) => {
    try {
      const event = JSON.parse(data.toString()) as JetstreamEvent;
      handleJetstreamEvent(event);
    } catch (error) {
      console.error('Error parsing Jetstream message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Jetstream connection closed');
    scheduleReconnect();
  });

  ws.on('error', (error) => {
    console.error('Jetstream WebSocket error:', error);
  });
}

function scheduleReconnect(): void {
  // Exponential backoff: 1s, 2s, 4s, 8s, ... up to MAX_RECONNECT_DELAY
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;

  console.log(`Reconnecting to Jetstream in ${delay / 1000} seconds...`);

  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    startJetstreamListener();
  }, delay);
}

function handleJetstreamEvent(event: JetstreamEvent): void {
  const { did } = event;

  // Track cursor from event timestamp for resumption
  if (event.time_us) {
    lastCursor = event.time_us.toString();
  }

  // Handle identity events (handle changes)
  if (event.kind === 'identity' && event.identity) {
    handleIdentityEvent(did, event.identity);
    return;
  }

  // Only process commit events for documents/publications
  if (event.kind !== 'commit' || !event.commit) {
    return;
  }

  const { collection, rkey, operation, record } = event.commit;

  // Check if this is a Leaflet collection we care about
  if (!LEAFLET_COLLECTIONS.includes(collection)) {
    return;
  }

  // Check if this user is registered in our system (using cache)
  const registeredDids = getRegisteredDids();
  if (!registeredDids.has(did)) {
    // User not registered, ignore
    return;
  }

  console.log(`Jetstream: ${operation} ${collection} from ${did}`);

  // Process based on collection type
  if (collection === 'pub.leaflet.document') {
    processIncomingDocument(
      did,
      rkey,
      record as unknown as LeafletDocument,
      operation
    );
  } else if (collection === 'pub.leaflet.publication') {
    processIncomingPublication(
      did,
      rkey,
      record as unknown as LeafletPublication,
      operation
    );
  } else if (collection === 'pub.leaflet.canvas') {
    processIncomingCanvas(
      did,
      rkey,
      record as unknown as LeafletCanvas,
      operation
    );
  }
}

function handleIdentityEvent(did: string, identity: { did: string; handle?: string }): void {
  // Only process if user is registered
  const registeredDids = getRegisteredDids();
  if (!registeredDids.has(did)) {
    return;
  }

  // Update handle if provided
  if (identity.handle) {
    const updated = db.updateUserHandle(did, identity.handle);
    if (updated) {
      console.log(`Jetstream: Updated handle for ${did} to ${identity.handle}`);
    }
  }
}

function saveCursor(): void {
  if (lastCursor) {
    db.setJetstreamCursor(lastCursor);
  }
}

export function stopJetstreamListener(): void {
  // Clear cursor save interval
  if (cursorSaveInterval) {
    clearInterval(cursorSaveInterval);
    cursorSaveInterval = null;
  }

  // Save final cursor before shutdown
  saveCursor();

  // Clear any pending reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }
}

export function isJetstreamConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
