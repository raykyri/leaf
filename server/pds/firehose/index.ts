/**
 * Firehose Event Stream
 * Handles event sequencing and WebSocket streaming for federation
 */

import { CID } from 'multiformats/cid';
// @ts-ignore - @ipld/dag-cbor types not resolving correctly due to exports
import * as cbor from '@ipld/dag-cbor';
import { getDatabase } from '../../database/index.ts';

// Event types
export type FirehoseEventType = 'commit' | 'identity' | 'account';

export interface CommitOp {
  action: 'create' | 'update' | 'delete';
  path: string;
  cid: CID | null;
}

export interface FirehoseCommitEvent {
  seq: number;
  rebase: boolean;
  tooBig: boolean;
  repo: string;
  commit: CID;
  rev: string;
  since: string | null;
  blocks: Uint8Array;
  ops: Array<{
    action: string;
    path: string;
    cid: { $link: string } | null;
  }>;
  blobs: string[];
  time: string;
}

export interface FirehoseIdentityEvent {
  seq: number;
  did: string;
  time: string;
  handle?: string;
}

export interface FirehoseAccountEvent {
  seq: number;
  did: string;
  time: string;
  active: boolean;
  status?: 'active' | 'takendown' | 'suspended' | 'deleted' | 'deactivated';
}

export type FirehoseEvent = FirehoseCommitEvent | FirehoseIdentityEvent | FirehoseAccountEvent;

// Active WebSocket connections
const subscribers = new Set<{
  send: (data: Uint8Array) => void;
  cursor?: number;
}>();

/**
 * Emit a commit event to the firehose
 */
export async function emitCommitEvent(
  did: string,
  commitCid: CID,
  rev: string,
  since: string | null,
  ops: Array<{ action: string; path: string; cid: CID | null }>,
  blocks: Map<CID, Uint8Array>
): Promise<number> {
  const db = getDatabase();

  // Build minimal CAR with changed blocks
  const carSlice = await buildCAR(commitCid, blocks);

  // Format ops for storage
  const opsJson = JSON.stringify(
    ops.map((op) => ({
      action: op.action,
      path: op.path,
      cid: op.cid ? op.cid.toString() : null,
    }))
  );

  // Insert event
  const result = db
    .prepare(
      `INSERT INTO firehose_events (repo_did, event_type, commit_cid, rev, since, ops, blobs, car_slice)
       VALUES (?, 'commit', ?, ?, ?, ?, '[]', ?)`
    )
    .run(did, commitCid.toString(), rev, since, opsJson, Buffer.from(carSlice));

  const seq = result.lastInsertRowid as number;

  // Broadcast to subscribers
  const event = await buildCommitEventMessage(seq, did, commitCid, rev, since, ops, carSlice);
  broadcastEvent(event, seq);

  return seq;
}

/**
 * Emit an identity change event
 */
export async function emitIdentityEvent(did: string, handle?: string): Promise<number> {
  const db = getDatabase();

  const result = db
    .prepare(
      `INSERT INTO firehose_events (repo_did, event_type, ops)
       VALUES (?, 'identity', ?)`
    )
    .run(did, JSON.stringify({ handle }));

  const seq = result.lastInsertRowid as number;

  const event = buildIdentityEventMessage(seq, did, handle);
  broadcastEvent(event, seq);

  return seq;
}

/**
 * Emit an account status change event
 */
export async function emitAccountEvent(
  did: string,
  active: boolean,
  status?: 'active' | 'takendown' | 'suspended' | 'deleted' | 'deactivated'
): Promise<number> {
  const db = getDatabase();

  const result = db
    .prepare(
      `INSERT INTO firehose_events (repo_did, event_type, ops)
       VALUES (?, 'account', ?)`
    )
    .run(did, JSON.stringify({ active, status }));

  const seq = result.lastInsertRowid as number;

  const event = buildAccountEventMessage(seq, did, active, status);
  broadcastEvent(event, seq);

  return seq;
}

/**
 * Build a minimal CAR file from blocks
 */
async function buildCAR(root: CID, blocks: Map<CID, Uint8Array>): Promise<Uint8Array> {
  const { CarWriter } = await import('@ipld/car');

  const { writer, out } = CarWriter.create([root]);

  const chunks: Uint8Array[] = [];
  const reader = (async () => {
    for await (const chunk of out) {
      chunks.push(chunk);
    }
  })();

  for (const [cid, bytes] of blocks) {
    await writer.put({ cid, bytes });
  }
  await writer.close();

  await reader;

  // Concatenate chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Build commit event message in DAG-CBOR frame format
 */
async function buildCommitEventMessage(
  seq: number,
  did: string,
  commitCid: CID,
  rev: string,
  since: string | null,
  ops: Array<{ action: string; path: string; cid: CID | null }>,
  carSlice: Uint8Array
): Promise<Uint8Array> {
  const header = cbor.encode({ op: 1, t: '#commit' });
  const payload = cbor.encode({
    seq,
    rebase: false,
    tooBig: false,
    repo: did,
    commit: commitCid,
    rev,
    since,
    blocks: carSlice,
    ops: ops.map((op) => ({
      action: op.action,
      path: op.path,
      cid: op.cid ? { $link: op.cid.toString() } : null,
    })),
    blobs: [],
    time: new Date().toISOString(),
  });

  return concatBytes(header, payload);
}

/**
 * Build identity event message
 */
function buildIdentityEventMessage(seq: number, did: string, handle?: string): Uint8Array {
  const header = cbor.encode({ op: 1, t: '#identity' });
  const payload = cbor.encode({
    seq,
    did,
    time: new Date().toISOString(),
    handle,
  });

  return concatBytes(header, payload);
}

/**
 * Build account event message
 */
function buildAccountEventMessage(
  seq: number,
  did: string,
  active: boolean,
  status?: string
): Uint8Array {
  const header = cbor.encode({ op: 1, t: '#account' });
  const payload = cbor.encode({
    seq,
    did,
    time: new Date().toISOString(),
    active,
    status,
  });

  return concatBytes(header, payload);
}

/**
 * Concatenate byte arrays
 */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Broadcast event to all subscribers
 */
function broadcastEvent(event: Uint8Array, seq: number): void {
  for (const subscriber of subscribers) {
    // Only send if subscriber's cursor is before this event
    if (!subscriber.cursor || subscriber.cursor < seq) {
      try {
        subscriber.send(event);
      } catch (error) {
        console.error('Error sending to subscriber:', error);
        subscribers.delete(subscriber);
      }
    }
  }
}

/**
 * Add a subscriber to the firehose
 */
export function addSubscriber(
  send: (data: Uint8Array) => void,
  cursor?: number
): { unsubscribe: () => void } {
  const subscriber = { send, cursor };
  subscribers.add(subscriber);

  // If cursor provided, replay events from cursor
  if (cursor !== undefined) {
    replayEventsFromCursor(subscriber, cursor).catch((error) => {
      console.error('Error replaying events:', error);
    });
  }

  return {
    unsubscribe: () => {
      subscribers.delete(subscriber);
    },
  };
}

/**
 * Replay events from a cursor position
 */
async function replayEventsFromCursor(
  subscriber: { send: (data: Uint8Array) => void; cursor?: number },
  cursor: number
): Promise<void> {
  const db = getDatabase();

  const events = db
    .prepare(
      `SELECT seq, repo_did, event_type, commit_cid, rev, since, ops, car_slice
       FROM firehose_events
       WHERE seq > ?
       ORDER BY seq ASC
       LIMIT 1000`
    )
    .all(cursor) as Array<{
    seq: number;
    repo_did: string;
    event_type: string;
    commit_cid: string | null;
    rev: string | null;
    since: string | null;
    ops: string;
    car_slice: Buffer | null;
  }>;

  for (const event of events) {
    let message: Uint8Array;

    if (event.event_type === 'commit' && event.commit_cid && event.rev && event.car_slice) {
      const ops = JSON.parse(event.ops) as Array<{
        action: string;
        path: string;
        cid: string | null;
      }>;
      message = await buildCommitEventMessage(
        event.seq,
        event.repo_did,
        CID.parse(event.commit_cid),
        event.rev,
        event.since,
        ops.map((op) => ({
          action: op.action,
          path: op.path,
          cid: op.cid ? CID.parse(op.cid) : null,
        })),
        new Uint8Array(event.car_slice)
      );
    } else if (event.event_type === 'identity') {
      const data = JSON.parse(event.ops) as { handle?: string };
      message = buildIdentityEventMessage(event.seq, event.repo_did, data.handle);
    } else if (event.event_type === 'account') {
      const data = JSON.parse(event.ops) as { active: boolean; status?: string };
      message = buildAccountEventMessage(
        event.seq,
        event.repo_did,
        data.active,
        data.status as any
      );
    } else {
      continue;
    }

    try {
      subscriber.send(message);
    } catch (error) {
      console.error('Error replaying event:', error);
      break;
    }
  }

  // Update subscriber's cursor
  if (events.length > 0) {
    subscriber.cursor = events[events.length - 1].seq;
  }
}

/**
 * Get the latest sequence number
 */
export function getLatestSeq(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT MAX(seq) as seq FROM firehose_events').get() as { seq: number | null };
  return row?.seq || 0;
}

/**
 * Clean up old firehose events (keep last N days)
 */
export function cleanupOldEvents(maxAgeDays: number = 7): number {
  const db = getDatabase();
  const result = db
    .prepare(
      `DELETE FROM firehose_events
       WHERE created_at < datetime('now', '-' || ? || ' days')`
    )
    .run(maxAgeDays);
  return result.changes;
}
