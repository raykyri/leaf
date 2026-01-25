/**
 * Firehose (Event Stream)
 *
 * Provides a WebSocket endpoint for streaming repository events.
 * Implements the com.atproto.sync.subscribeRepos endpoint.
 *
 * Uses an event emitter pattern for immediate event delivery instead of polling.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import {
  getPdsSequencerEventsSince,
  getLatestSequence,
} from '../database/queries.ts';

export interface FirehoseConnection {
  ws: WebSocket;
  cursor: number;
  did?: string; // Optional filter by DID
}

export interface SequencerEvent {
  seq: number;
  did: string;
  commit_cid: string | null;
  event_type: string;
  event_data: Buffer;
  created_at: string;
}

// Event emitter for real-time event distribution
class FirehoseEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Allow many listeners (one per WebSocket connection)
    this.setMaxListeners(10000);
  }
}

const firehoseEmitter = new FirehoseEventEmitter();

// Active connections
const connections = new Set<FirehoseConnection>();

// Legacy polling support (can be disabled when all events go through emitter)
let pollInterval: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 1000; // Increased to 1s as backup only
let lastPolledSeq = 0;

/**
 * Handle a new WebSocket connection for the firehose
 */
export function handleFirehoseConnection(
  ws: WebSocket,
  cursor?: number
): void {
  const startCursor = cursor ?? getLatestSequence();

  const connection: FirehoseConnection = {
    ws,
    cursor: startCursor,
  };

  connections.add(connection);

  // Create event handler for this connection
  const eventHandler = (event: SequencerEvent) => {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Check if connection wants this event
    if (event.seq <= connection.cursor) {
      return;
    }

    // Check DID filter
    if (connection.did && connection.did !== event.did) {
      return;
    }

    sendEvent(connection, event);
    connection.cursor = event.seq;
  };

  // Subscribe to real-time events
  firehoseEmitter.on('event', eventHandler);

  // If cursor is in the past, replay events
  if (cursor !== undefined && cursor < startCursor) {
    replayEvents(connection, cursor);
  }

  // Handle close
  ws.on('close', () => {
    firehoseEmitter.off('event', eventHandler);
    connections.delete(connection);
    maybeStopPolling();
  });

  ws.on('error', () => {
    firehoseEmitter.off('event', eventHandler);
    connections.delete(connection);
    maybeStopPolling();
  });

  // Start backup polling if not already (catches any events that might be missed)
  maybeStartPolling();
}

/**
 * Replay events from a cursor position
 */
async function replayEvents(connection: FirehoseConnection, fromCursor: number): Promise<void> {
  const batchSize = 100;
  let cursor = fromCursor;

  while (connection.ws.readyState === WebSocket.OPEN) {
    const events = getPdsSequencerEventsSince(cursor, batchSize);

    if (events.length === 0) {
      break;
    }

    for (const event of events) {
      if (connection.ws.readyState !== WebSocket.OPEN) {
        break;
      }

      // Send event to client
      sendEvent(connection, event);
      cursor = event.seq;
    }

    // Update connection cursor
    connection.cursor = cursor;

    if (events.length < batchSize) {
      break;
    }
  }
}

/**
 * Send an event to a connection
 */
function sendEvent(
  connection: FirehoseConnection,
  event: {
    seq: number;
    did: string;
    commit_cid: string | null;
    event_type: string;
    event_data: Buffer;
    created_at: string;
  }
): void {
  // Parse event data
  let eventData: unknown;
  try {
    eventData = JSON.parse(event.event_data.toString());
  } catch {
    eventData = {};
  }

  // Build frame
  const frame = {
    $type: `com.atproto.sync.subscribeRepos#${event.event_type}`,
    seq: event.seq,
    did: event.did,
    time: event.created_at,
    ...(typeof eventData === 'object' ? eventData : {}),
  };

  try {
    connection.ws.send(JSON.stringify(frame));
  } catch (error) {
    console.error('Error sending firehose event:', error);
  }
}

/**
 * Start polling for new events
 */
function maybeStartPolling(): void {
  if (pollInterval !== null || connections.size === 0) {
    return;
  }

  pollInterval = setInterval(() => {
    pollForNewEvents();
  }, POLL_INTERVAL_MS);
}

/**
 * Stop polling for new events
 */
function maybeStopPolling(): void {
  if (connections.size > 0 || pollInterval === null) {
    return;
  }

  clearInterval(pollInterval);
  pollInterval = null;
}

/**
 * Poll for new events and distribute to connections (backup mechanism)
 * Primary delivery is via the event emitter, this catches any missed events.
 */
function pollForNewEvents(): void {
  if (connections.size === 0) {
    return;
  }

  // Get events since last polled sequence
  const events = getPdsSequencerEventsSince(lastPolledSeq, 100);

  if (events.length === 0) {
    return;
  }

  // Update last polled sequence
  lastPolledSeq = events[events.length - 1].seq;

  // Send events to appropriate connections (backup delivery)
  for (const event of events) {
    for (const connection of connections) {
      if (connection.ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      // Check if connection wants this event (skip if already delivered)
      if (event.seq <= connection.cursor) {
        continue;
      }

      // Check DID filter
      if (connection.did && connection.did !== event.did) {
        continue;
      }

      sendEvent(connection, event);
      connection.cursor = event.seq;
    }
  }
}

/**
 * Emit a sequencer event to all connected clients immediately.
 * This is called from the repository when a new event is created.
 */
export function emitSequencerEvent(event: SequencerEvent): void {
  // Update last polled seq to avoid duplicate delivery via polling
  if (event.seq > lastPolledSeq) {
    lastPolledSeq = event.seq;
  }

  // Emit to all listeners
  firehoseEmitter.emit('event', event);
}

/**
 * Initialize the firehose with the current sequence number
 */
export function initializeFirehose(): void {
  lastPolledSeq = getLatestSequence();
}

/**
 * Get the current number of active connections
 */
export function getConnectionCount(): number {
  return connections.size;
}

/**
 * Broadcast an event to all connections (called when a new event is created)
 */
export function broadcastEvent(event: {
  seq: number;
  did: string;
  commit_cid: string | null;
  event_type: string;
  event_data: Buffer;
  created_at: string;
}): void {
  for (const connection of connections) {
    if (connection.ws.readyState !== WebSocket.OPEN) {
      continue;
    }

    // Check DID filter
    if (connection.did && connection.did !== event.did) {
      continue;
    }

    sendEvent(connection, event);
    connection.cursor = event.seq;
  }
}

/**
 * Create a WebSocket server for the firehose
 */
export function createFirehoseServer(path: string): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    // Parse cursor from query string
    const url = new URL(req.url || '', 'http://localhost');
    const cursorParam = url.searchParams.get('cursor');
    const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;

    handleFirehoseConnection(ws, cursor);
  });

  return wss;
}
