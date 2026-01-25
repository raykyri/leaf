/**
 * XRPC Server
 *
 * Main XRPC endpoint routing for the PDS.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { rateLimits } from '../middleware/ratelimit.ts';

// Server handlers
import {
  describeServer,
  createSessionHandler,
  refreshSessionHandler,
  getSessionHandler,
  deleteSessionHandler,
  getAccountInviteCodesHandler,
  requestPasswordResetHandler,
  resetPasswordHandler,
} from './handlers/server.ts';

// Repo handlers
import {
  describeRepoHandler,
  createRecordHandler,
  putRecordHandler,
  deleteRecordHandler,
  getRecordHandler,
  listRecordsHandler,
  uploadBlobHandler,
  applyWritesHandler,
} from './handlers/repo.ts';

// Sync handlers
import {
  getRepoHandler,
  getLatestCommitHandler,
  getRepoStatusHandler,
  getBlobHandler,
  listBlobsHandler,
  getRecordHandler as getSyncRecordHandler,
  getBlocksHandler,
  getCheckoutHandler,
  listReposHandler,
  notifyOfUpdateHandler,
  requestCrawlHandler,
} from './handlers/sync.ts';

// Identity handlers
import {
  resolveHandleHandler,
  updateHandleHandler,
  getRecommendedDidCredentialsHandler,
  signPlcOperationHandler,
  submitPlcOperationHandler,
  requestPlcOperationSignatureHandler,
} from './handlers/identity.ts';

/**
 * Create the XRPC router
 */
export function createXrpcRouter(): Hono {
  const app = new Hono();

  // ============================================
  // com.atproto.server.* endpoints
  // ============================================

  app.get('/xrpc/com.atproto.server.describeServer', rateLimits.read, describeServer);
  app.post('/xrpc/com.atproto.server.createSession', rateLimits.auth, createSessionHandler);
  app.post('/xrpc/com.atproto.server.refreshSession', rateLimits.auth, refreshSessionHandler);
  app.get('/xrpc/com.atproto.server.getSession', rateLimits.standard, getSessionHandler);
  app.post('/xrpc/com.atproto.server.deleteSession', rateLimits.standard, deleteSessionHandler);
  app.get('/xrpc/com.atproto.server.getAccountInviteCodes', rateLimits.standard, getAccountInviteCodesHandler);
  app.post('/xrpc/com.atproto.server.requestPasswordReset', rateLimits.auth, requestPasswordResetHandler);
  app.post('/xrpc/com.atproto.server.resetPassword', rateLimits.auth, resetPasswordHandler);

  // ============================================
  // com.atproto.repo.* endpoints
  // ============================================

  app.get('/xrpc/com.atproto.repo.describeRepo', rateLimits.read, describeRepoHandler);
  app.post('/xrpc/com.atproto.repo.createRecord', rateLimits.write, createRecordHandler);
  app.post('/xrpc/com.atproto.repo.putRecord', rateLimits.write, putRecordHandler);
  app.post('/xrpc/com.atproto.repo.deleteRecord', rateLimits.write, deleteRecordHandler);
  app.get('/xrpc/com.atproto.repo.getRecord', rateLimits.read, getRecordHandler);
  app.get('/xrpc/com.atproto.repo.listRecords', rateLimits.read, listRecordsHandler);
  app.post('/xrpc/com.atproto.repo.uploadBlob', rateLimits.upload, uploadBlobHandler);
  app.post('/xrpc/com.atproto.repo.applyWrites', rateLimits.write, applyWritesHandler);

  // ============================================
  // com.atproto.sync.* endpoints
  // ============================================

  app.get('/xrpc/com.atproto.sync.getRepo', rateLimits.standard, getRepoHandler);
  app.get('/xrpc/com.atproto.sync.getLatestCommit', rateLimits.read, getLatestCommitHandler);
  app.get('/xrpc/com.atproto.sync.getRepoStatus', rateLimits.read, getRepoStatusHandler);
  app.get('/xrpc/com.atproto.sync.getBlob', rateLimits.standard, getBlobHandler);
  app.get('/xrpc/com.atproto.sync.listBlobs', rateLimits.read, listBlobsHandler);
  app.get('/xrpc/com.atproto.sync.getRecord', rateLimits.read, getSyncRecordHandler);
  app.get('/xrpc/com.atproto.sync.getBlocks', rateLimits.standard, getBlocksHandler);
  app.get('/xrpc/com.atproto.sync.getCheckout', rateLimits.standard, getCheckoutHandler);
  app.get('/xrpc/com.atproto.sync.listRepos', rateLimits.read, listReposHandler);
  app.post('/xrpc/com.atproto.sync.notifyOfUpdate', rateLimits.standard, notifyOfUpdateHandler);
  app.post('/xrpc/com.atproto.sync.requestCrawl', rateLimits.standard, requestCrawlHandler);

  // ============================================
  // com.atproto.identity.* endpoints
  // ============================================

  app.get('/xrpc/com.atproto.identity.resolveHandle', rateLimits.read, resolveHandleHandler);
  app.post('/xrpc/com.atproto.identity.updateHandle', rateLimits.write, updateHandleHandler);
  app.get('/xrpc/com.atproto.identity.getRecommendedDidCredentials', rateLimits.standard, getRecommendedDidCredentialsHandler);
  app.post('/xrpc/com.atproto.identity.signPlcOperation', rateLimits.write, signPlcOperationHandler);
  app.post('/xrpc/com.atproto.identity.submitPlcOperation', rateLimits.write, submitPlcOperationHandler);
  app.post('/xrpc/com.atproto.identity.requestPlcOperationSignature', rateLimits.write, requestPlcOperationSignatureHandler);

  // ============================================
  // Catch-all for unknown XRPC methods
  // ============================================

  app.all('/xrpc/:method', (c: Context) => {
    const method = c.req.param('method');
    return c.json({
      error: 'MethodNotImplemented',
      message: `XRPC method ${method} is not implemented`,
    }, 501);
  });

  return app;
}

/**
 * Handle XRPC errors consistently
 */
export function handleXrpcError(error: unknown): { status: number; body: { error: string; message: string } } {
  if (error instanceof Error) {
    // Check for known error types
    if (error.message.includes('not found')) {
      return {
        status: 404,
        body: { error: 'NotFound', message: error.message },
      };
    }
    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return {
        status: 401,
        body: { error: 'AuthRequired', message: error.message },
      };
    }
    if (error.message.includes('forbidden') || error.message.includes('permission')) {
      return {
        status: 403,
        body: { error: 'Forbidden', message: error.message },
      };
    }
    if (error.message.includes('invalid') || error.message.includes('validation')) {
      return {
        status: 400,
        body: { error: 'InvalidRequest', message: error.message },
      };
    }

    // Default internal error
    return {
      status: 500,
      body: { error: 'InternalError', message: error.message },
    };
  }

  return {
    status: 500,
    body: { error: 'InternalError', message: 'An unexpected error occurred' },
  };
}
