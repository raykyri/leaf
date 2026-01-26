/**
 * Relay Communication
 *
 * Handles communication with ATProto relays (BGS - Big Graph Service).
 * This allows the PDS to notify relays of updates and request crawls.
 */

import { getPdsConfig } from '../config.ts';
import { getLatestPdsCommit, getAllPdsAccountDids, getPdsRepoState } from '../database/queries.ts';

export interface RelayConfig {
  url: string;
  enabled: boolean;
}

export interface RelayStatus {
  url: string;
  connected: boolean;
  lastContact: Date | null;
  error: string | null;
}

// Registered relays
const registeredRelays: Map<string, RelayConfig> = new Map();

// Relay status tracking
const relayStatuses: Map<string, RelayStatus> = new Map();

/**
 * Register a relay for communication
 */
export function registerRelay(url: string): void {
  const normalizedUrl = url.replace(/\/$/, ''); // Remove trailing slash

  registeredRelays.set(normalizedUrl, {
    url: normalizedUrl,
    enabled: true,
  });

  relayStatuses.set(normalizedUrl, {
    url: normalizedUrl,
    connected: false,
    lastContact: null,
    error: null,
  });

  console.log(`Registered relay: ${normalizedUrl}`);
}

/**
 * Unregister a relay
 */
export function unregisterRelay(url: string): void {
  const normalizedUrl = url.replace(/\/$/, '');
  registeredRelays.delete(normalizedUrl);
  relayStatuses.delete(normalizedUrl);
}

/**
 * Get all registered relays
 */
export function getRegisteredRelays(): RelayConfig[] {
  return Array.from(registeredRelays.values());
}

/**
 * Get status of all relays
 */
export function getRelayStatuses(): RelayStatus[] {
  return Array.from(relayStatuses.values());
}

/**
 * Notify a relay that a repository has been updated
 */
export async function notifyRelayOfUpdate(
  relayUrl: string,
  did: string
): Promise<boolean> {
  const config = getPdsConfig();

  try {
    const response = await fetch(`${relayUrl}/xrpc/com.atproto.sync.notifyOfUpdate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname: new URL(config.publicUrl).hostname,
      }),
    });

    const status = relayStatuses.get(relayUrl);
    if (status) {
      status.lastContact = new Date();
      if (response.ok) {
        status.connected = true;
        status.error = null;
      } else {
        status.error = `HTTP ${response.status}`;
      }
    }

    return response.ok;
  } catch (error) {
    const status = relayStatuses.get(relayUrl);
    if (status) {
      status.connected = false;
      status.error = error instanceof Error ? error.message : 'Unknown error';
    }
    return false;
  }
}

/**
 * Notify all registered relays of an update
 */
export async function notifyAllRelaysOfUpdate(did: string): Promise<void> {
  const relays = getRegisteredRelays();

  const notifications = relays
    .filter(relay => relay.enabled)
    .map(relay => notifyRelayOfUpdate(relay.url, did));

  await Promise.allSettled(notifications);
}

/**
 * Request a relay to crawl this PDS
 */
export async function requestCrawl(relayUrl: string): Promise<boolean> {
  const config = getPdsConfig();

  try {
    const response = await fetch(`${relayUrl}/xrpc/com.atproto.sync.requestCrawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname: new URL(config.publicUrl).hostname,
      }),
    });

    const status = relayStatuses.get(relayUrl);
    if (status) {
      status.lastContact = new Date();
      if (response.ok) {
        status.connected = true;
        status.error = null;
      } else {
        status.error = `HTTP ${response.status}`;
      }
    }

    return response.ok;
  } catch (error) {
    const status = relayStatuses.get(relayUrl);
    if (status) {
      status.connected = false;
      status.error = error instanceof Error ? error.message : 'Unknown error';
    }
    return false;
  }
}

/**
 * Request crawl from all registered relays
 */
export async function requestCrawlFromAllRelays(): Promise<void> {
  const relays = getRegisteredRelays();

  const requests = relays
    .filter(relay => relay.enabled)
    .map(relay => requestCrawl(relay.url));

  await Promise.allSettled(requests);
}

/**
 * Subscribe to a relay's firehose
 */
export function subscribeToRelay(
  relayUrl: string,
  onMessage: (message: unknown) => void,
  onError?: (error: Error) => void
): WebSocket | null {
  try {
    const wsUrl = relayUrl.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsUrl}/xrpc/com.atproto.sync.subscribeRepos`);

    ws.onopen = () => {
      const status = relayStatuses.get(relayUrl);
      if (status) {
        status.connected = true;
        status.lastContact = new Date();
        status.error = null;
      }
      console.log(`Connected to relay firehose: ${relayUrl}`);
    };

    ws.onmessage = (event) => {
      try {
        // Relay messages are typically CBOR-encoded
        // For now, handle as JSON for simplicity
        const data = typeof event.data === 'string'
          ? JSON.parse(event.data)
          : event.data;
        onMessage(data);
      } catch (error) {
        console.error('Error processing relay message:', error);
      }
    };

    ws.onerror = (event) => {
      const status = relayStatuses.get(relayUrl);
      if (status) {
        status.connected = false;
        status.error = 'WebSocket error';
      }
      if (onError) {
        onError(new Error('WebSocket error'));
      }
    };

    ws.onclose = () => {
      const status = relayStatuses.get(relayUrl);
      if (status) {
        status.connected = false;
      }
      console.log(`Disconnected from relay firehose: ${relayUrl}`);
    };

    return ws;
  } catch (error) {
    console.error(`Failed to connect to relay: ${relayUrl}`, error);
    return null;
  }
}

/**
 * Announce this PDS to the Bluesky relay network
 * Call this on PDS startup to make the PDS discoverable
 */
export async function announceToNetwork(): Promise<void> {
  const config = getPdsConfig();

  // Default Bluesky relay
  const defaultRelayUrl = 'https://bsky.network';

  // Register the default relay if not already registered
  if (!registeredRelays.has(defaultRelayUrl)) {
    registerRelay(defaultRelayUrl);
  }

  // Request crawl from all relays
  console.log('Announcing PDS to relay network...');
  await requestCrawlFromAllRelays();
  console.log('PDS announced to relay network');
}

/**
 * Get repo info for relay communication
 */
export function getRepoInfoForRelay(did: string): {
  did: string;
  head: string;
  rev: string;
} | null {
  const state = getPdsRepoState(did);
  if (!state) {
    return null;
  }

  return {
    did,
    head: state.head_cid,
    rev: state.head_rev,
  };
}

/**
 * Emit update event (called after repository changes)
 * This notifies all registered relays of the update
 */
export async function emitRepoUpdate(did: string): Promise<void> {
  // Notify relays asynchronously (don't block the main operation)
  setImmediate(() => {
    notifyAllRelaysOfUpdate(did).catch(error => {
      console.error('Failed to notify relays of update:', error);
    });
  });
}
