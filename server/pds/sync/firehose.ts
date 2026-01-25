/**
 * Firehose (Event Stream)
 *
 * Provides a WebSocket endpoint for streaming repository events.
 * Implements the com.atproto.sync.subscribeRepos endpoint.
 */

import { WebSocketServer, WebSocket } from 'ws';
import {
  getPdsSequencerEventsSince,
  getLatestSequence,
} from '../database/queries.ts';

export interface FirehoseConnection {
  ws: WebSocket;
  cursor: number;
  did?: string; // Optional filter by DID
}

// Active connections
const connections = new Set<FirehoseConnection>();

// Polling interval for new events (in production, use database triggers or pub/sub)
let pollInterval: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 100;

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

  // If cursor is in the past, replay events
  if (cursor !== undefined && cursor < startCursor) {
    replayEvents(connection, cursor);
  }

  // Handle close
  ws.on('close', () => {
    connections.delete(connection);
    maybeStopPolling();
  });

  ws.on('error', () => {
    connections.delete(connection);
    maybeStopPolling();
  });

  // Start polling if not already
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
 * Poll for new events and distribute to connections
 */
function pollForNewEvents(): void {
  if (connections.size === 0) {
    return;
  }

  // Find the minimum cursor among all connections
  let minCursor = Infinity;
  for (const connection of connections) {
    if (connection.cursor < minCursor) {
      minCursor = connection.cursor;
    }
  }

  if (minCursor === Infinity) {
    return;
  }

  // Get new events
  const events = getPdsSequencerEventsSince(minCursor, 100);

  if (events.length === 0) {
    return;
  }

  // Send events to appropriate connections
  for (const event of events) {
    for (const connection of connections) {
      if (connection.ws.readyState !== WebSocket.OPEN) {
        continue;
      }

      // Check if connection wants this event
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
