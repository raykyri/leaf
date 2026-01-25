/**
 * XRPC Server
 *
 * Main XRPC endpoint routing for the PDS.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';

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

  app.get('/xrpc/com.atproto.server.describeServer', describeServer);
  app.post('/xrpc/com.atproto.server.createSession', createSessionHandler);
  app.post('/xrpc/com.atproto.server.refreshSession', refreshSessionHandler);
  app.get('/xrpc/com.atproto.server.getSession', getSessionHandler);
  app.post('/xrpc/com.atproto.server.deleteSession', deleteSessionHandler);
  app.get('/xrpc/com.atproto.server.getAccountInviteCodes', getAccountInviteCodesHandler);
  app.post('/xrpc/com.atproto.server.requestPasswordReset', requestPasswordResetHandler);
  app.post('/xrpc/com.atproto.server.resetPassword', resetPasswordHandler);

  // ============================================
  // com.atproto.repo.* endpoints
  // ============================================

  app.get('/xrpc/com.atproto.repo.describeRepo', describeRepoHandler);
  app.post('/xrpc/com.atproto.repo.createRecord', createRecordHandler);
  app.post('/xrpc/com.atproto.repo.putRecord', putRecordHandler);
  app.post('/xrpc/com.atproto.repo.deleteRecord', deleteRecordHandler);
  app.get('/xrpc/com.atproto.repo.getRecord', getRecordHandler);
  app.get('/xrpc/com.atproto.repo.listRecords', listRecordsHandler);
  app.post('/xrpc/com.atproto.repo.uploadBlob', uploadBlobHandler);
  app.post('/xrpc/com.atproto.repo.applyWrites', applyWritesHandler);

  // ============================================
  // com.atproto.sync.* endpoints
  // ============================================

  app.get('/xrpc/com.atproto.sync.getRepo', getRepoHandler);
  app.get('/xrpc/com.atproto.sync.getLatestCommit', getLatestCommitHandler);
  app.get('/xrpc/com.atproto.sync.getRepoStatus', getRepoStatusHandler);
  app.get('/xrpc/com.atproto.sync.getBlob', getBlobHandler);
  app.get('/xrpc/com.atproto.sync.listBlobs', listBlobsHandler);
  app.get('/xrpc/com.atproto.sync.getRecord', getSyncRecordHandler);
  app.get('/xrpc/com.atproto.sync.getBlocks', getBlocksHandler);
  app.get('/xrpc/com.atproto.sync.getCheckout', getCheckoutHandler);
  app.get('/xrpc/com.atproto.sync.listRepos', listReposHandler);
  app.post('/xrpc/com.atproto.sync.notifyOfUpdate', notifyOfUpdateHandler);
  app.post('/xrpc/com.atproto.sync.requestCrawl', requestCrawlHandler);

  // ============================================
  // com.atproto.identity.* endpoints
  // ============================================

  app.get('/xrpc/com.atproto.identity.resolveHandle', resolveHandleHandler);
  app.post('/xrpc/com.atproto.identity.updateHandle', updateHandleHandler);
  app.get('/xrpc/com.atproto.identity.getRecommendedDidCredentials', getRecommendedDidCredentialsHandler);
  app.post('/xrpc/com.atproto.identity.signPlcOperation', signPlcOperationHandler);
  app.post('/xrpc/com.atproto.identity.submitPlcOperation', submitPlcOperationHandler);
  app.post('/xrpc/com.atproto.identity.requestPlcOperationSignature', requestPlcOperationSignatureHandler);

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
