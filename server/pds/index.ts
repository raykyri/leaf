/**
 * PDS Main Entry Point
 * Initializes and exports all PDS components
 */

import type { Hono } from 'hono';
import { getDatabase } from '../database/index.ts';
import { initializePDSSchema } from './schema.ts';
import { getPDSConfig, isPDSEnabled } from './config.ts';
import { mountXRPCRoutes } from './xrpc/index.ts';
import { mountOAuthRoutes } from './oauth/index.ts';
import { mountSocialAuthRoutes } from './routes/social-auth.ts';
import { addSubscriber, getLatestSeq } from './firehose/index.ts';
import { garbageCollectBlobs } from './blob/index.ts';

let initialized = false;

/**
 * Initialize PDS components
 */
export function initializePDS(): void {
  if (initialized) {
    return;
  }

  if (!isPDSEnabled()) {
    console.log('PDS not enabled - set GITHUB_CLIENT_ID or GOOGLE_CLIENT_ID to enable');
    return;
  }

  console.log('Initializing PDS...');

  // Initialize database schema
  const db = getDatabase();
  initializePDSSchema(db);

  const config = getPDSConfig();
  console.log(`PDS configured for ${config.publicUrl}`);
  console.log(`Handle domain: ${config.handleDomain}`);

  // Start background tasks
  startBackgroundTasks();

  initialized = true;
  console.log('PDS initialized successfully');
}

/**
 * Mount PDS routes on Hono app
 */
export function mountPDSRoutes(app: Hono): void {
  if (!isPDSEnabled()) {
    return;
  }

  // Ensure PDS is initialized
  initializePDS();

  // Mount XRPC routes
  mountXRPCRoutes(app);

  // Mount OAuth routes
  mountOAuthRoutes(app);

  // Mount social auth routes
  mountSocialAuthRoutes(app);

  console.log('PDS routes mounted');
}

/**
 * Set up WebSocket handler for firehose
 */
export function setupFirehoseWebSocket(wss: any): void {
  if (!isPDSEnabled()) {
    return;
  }

  wss.on('connection', (ws: any, req: any) => {
    const url = new URL(req.url, 'http://localhost');

    // Only handle firehose endpoint
    if (url.pathname !== '/xrpc/com.atproto.sync.subscribeRepos') {
      return;
    }

    const cursor = url.searchParams.get('cursor');
    const cursorNum = cursor ? parseInt(cursor, 10) : undefined;

    console.log(`Firehose subscriber connected (cursor: ${cursorNum || 'none'})`);

    const subscription = addSubscriber(
      (data: Uint8Array) => {
        try {
          ws.send(data);
        } catch (error) {
          console.error('Error sending to firehose subscriber:', error);
        }
      },
      cursorNum
    );

    ws.on('close', () => {
      console.log('Firehose subscriber disconnected');
      subscription.unsubscribe();
    });

    ws.on('error', (error: Error) => {
      console.error('Firehose WebSocket error:', error);
      subscription.unsubscribe();
    });
  });
}

/**
 * Start background maintenance tasks
 */
function startBackgroundTasks(): void {
  // Garbage collect orphaned blobs every 30 minutes
  setInterval(async () => {
    try {
      const deleted = await garbageCollectBlobs(30);
      if (deleted > 0) {
        console.log(`PDS: Garbage collected ${deleted} orphaned blobs`);
      }
    } catch (error) {
      console.error('PDS: Blob garbage collection failed:', error);
    }
  }, 30 * 60 * 1000);

  // Clean up expired OAuth codes/tokens every hour
  setInterval(() => {
    try {
      const db = getDatabase();
      const codesDeleted = db
        .prepare("DELETE FROM pds_oauth_codes WHERE expires_at < datetime('now')")
        .run().changes;
      const tokensDeleted = db
        .prepare("DELETE FROM pds_oauth_tokens WHERE expires_at < datetime('now')")
        .run().changes;

      if (codesDeleted > 0 || tokensDeleted > 0) {
        console.log(`PDS: Cleaned up ${codesDeleted} expired codes, ${tokensDeleted} expired tokens`);
      }
    } catch (error) {
      console.error('PDS: OAuth cleanup failed:', error);
    }
  }, 60 * 60 * 1000);

  // Clean up old social OAuth states every 10 minutes
  setInterval(() => {
    try {
      const db = getDatabase();
      const deleted = db
        .prepare("DELETE FROM social_oauth_state WHERE created_at < datetime('now', '-10 minutes')")
        .run().changes;

      if (deleted > 0) {
        console.log(`PDS: Cleaned up ${deleted} expired social OAuth states`);
      }
    } catch (error) {
      console.error('PDS: Social OAuth state cleanup failed:', error);
    }
  }, 10 * 60 * 1000);
}

// Re-export commonly used functions
export { isPDSEnabled, getPDSConfig } from './config.ts';
export { getRepository, initializeRepository, generateTid } from './repo/index.ts';
export { getSocialUserSigningKey } from './social-auth/index.ts';
export { resolveHandle, verifyHandle } from './identity/index.ts';
