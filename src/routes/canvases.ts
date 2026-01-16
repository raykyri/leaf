import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import * as db from '../database/index.js';
import { getSessionUser, getAuthenticatedAgent } from '../services/auth.js';
import { publishCanvas } from '../services/posts.js';
import { saveCanvasToATProto, deleteCanvasFromATProto } from '../services/canvas.js';
import { getCsrfToken } from '../middleware/csrf.js';
import {
  canvasListPage,
  canvasEditorPage,
  createCanvasPage,
  notFoundPage,
  errorPage
} from '../views/pages.js';
import crypto from 'crypto';

const canvases = new Hono();
const CANVASES_PER_PAGE = 20;

// Generate a unique canvas ID
function generateCanvasId(): string {
  return crypto.randomBytes(8).toString('hex');
}

// Validate canvas ID format
function isValidCanvasId(id: string | undefined): id is string {
  if (typeof id !== 'string') return false;
  return /^[a-f0-9]{16}$/.test(id);
}

// Get current user from session
function getCurrentUser(c: Context): { user: db.User; session: db.Session } | null {
  const sessionToken = getCookie(c, 'session');
  if (!sessionToken) return null;
  return getSessionUser(sessionToken);
}

// List all canvases for current user
canvases.get('/canvases', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const offset = (page - 1) * CANVASES_PER_PAGE;
  const csrfToken = getCsrfToken(getCookie(c, 'session'));

  const userCanvases = db.getCanvasesByUser(auth.user.id, CANVASES_PER_PAGE + 1, offset);
  const hasMore = userCanvases.length > CANVASES_PER_PAGE;
  const displayCanvases = userCanvases.slice(0, CANVASES_PER_PAGE);

  return c.html(canvasListPage(displayCanvases, page, hasMore, { handle: auth.user.handle, csrfToken }));
});

// Create canvas form
canvases.get('/canvases/new', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const csrfToken = getCsrfToken(getCookie(c, 'session'));
  return c.html(createCanvasPage({ handle: auth.user.handle, csrfToken }));
});

// Handle canvas creation
canvases.post('/canvases/new', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const body = await c.req.parseBody();
  const title = body.title as string | undefined;
  const csrfToken = getCsrfToken(getCookie(c, 'session'));

  if (!title || title.trim().length === 0) {
    return c.html(createCanvasPage({ handle: auth.user.handle, csrfToken }, 'Title is required'));
  }

  if (title.length > 128) {
    return c.html(createCanvasPage({ handle: auth.user.handle, csrfToken }, 'Title must be 128 characters or less'));
  }

  const canvasId = generateCanvasId();
  db.createCanvas(canvasId, auth.user.id, title.trim());

  return c.redirect(`/canvases/${canvasId}`);
});

// View/edit a canvas
canvases.get('/canvases/:id', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const canvasId = c.req.param('id');
  const csrfToken = getCsrfToken(getCookie(c, 'session'));

  if (!isValidCanvasId(canvasId)) {
    return c.html(errorPage({ handle: auth.user.handle, csrfToken }, 'Invalid canvas identifier'), 400);
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    return c.html(notFoundPage({ handle: auth.user.handle, csrfToken }), 404);
  }

  // Check ownership
  if (canvas.user_id !== auth.user.id) {
    return c.html(errorPage({ handle: auth.user.handle, csrfToken }, 'You do not have access to this canvas'), 403);
  }

  return c.html(canvasEditorPage(canvas, { handle: auth.user.handle, csrfToken }));
});

// API: Get canvas data
canvases.get('/api/canvases/:id', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const canvasId = c.req.param('id');

  if (!isValidCanvasId(canvasId)) {
    return c.json({ error: 'Invalid canvas identifier' }, 400);
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    return c.json({ error: 'Canvas not found' }, 404);
  }

  if (canvas.user_id !== auth.user.id) {
    return c.json({ error: 'Access denied' }, 403);
  }

  return c.json({
    id: canvas.id,
    title: canvas.title,
    blocks: JSON.parse(canvas.blocks),
    width: canvas.width,
    height: canvas.height,
    created_at: canvas.created_at,
    updated_at: canvas.updated_at
  });
});

// API: Update canvas
canvases.put('/api/canvases/:id', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const canvasId = c.req.param('id');

  if (!isValidCanvasId(canvasId)) {
    return c.json({ error: 'Invalid canvas identifier' }, 400);
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    return c.json({ error: 'Canvas not found' }, 404);
  }

  if (canvas.user_id !== auth.user.id) {
    return c.json({ error: 'Access denied' }, 403);
  }

  const body = await c.req.json();
  const { title, blocks, width, height } = body;
  const updates: { title?: string; blocks?: string; width?: number; height?: number } = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return c.json({ error: 'Title is required' }, 400);
    }
    if (title.length > 128) {
      return c.json({ error: 'Title must be 128 characters or less' }, 400);
    }
    updates.title = title.trim();
  }

  if (blocks !== undefined) {
    if (!Array.isArray(blocks)) {
      return c.json({ error: 'Blocks must be an array' }, 400);
    }
    updates.blocks = JSON.stringify(blocks);
  }

  if (width !== undefined) {
    if (typeof width !== 'number' || width < 100 || width > 10000) {
      return c.json({ error: 'Width must be between 100 and 10000' }, 400);
    }
    updates.width = width;
  }

  if (height !== undefined) {
    if (typeof height !== 'number' || height < 100 || height > 10000) {
      return c.json({ error: 'Height must be between 100 and 10000' }, 400);
    }
    updates.height = height;
  }

  // Update local database first
  db.updateCanvas(canvasId, updates);
  const updatedCanvas = db.getCanvasById(canvasId)!;

  // Sync to ATProto
  let syncError: string | undefined;
  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (agent) {
      const syncResult = await saveCanvasToATProto(agent, auth.user, updatedCanvas);
      if (!syncResult.success) {
        syncError = syncResult.error;
        console.error('Failed to sync canvas to ATProto:', syncResult.error);
      }
    } else {
      syncError = 'Unable to authenticate with ATProto';
      console.error('Failed to get authenticated agent for canvas sync');
    }
  } catch (error) {
    syncError = error instanceof Error ? error.message : 'ATProto sync failed';
    console.error('Error syncing canvas to ATProto:', error);
  }

  // Return updated canvas with sync status
  const finalCanvas = db.getCanvasById(canvasId)!;
  return c.json({
    id: finalCanvas.id,
    title: finalCanvas.title,
    blocks: JSON.parse(finalCanvas.blocks),
    width: finalCanvas.width,
    height: finalCanvas.height,
    created_at: finalCanvas.created_at,
    updated_at: finalCanvas.updated_at,
    uri: finalCanvas.uri,
    synced: !syncError,
    syncError
  });
});

// Handle canvas deletion
canvases.post('/canvases/:id/delete', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const canvasId = c.req.param('id');

  if (!isValidCanvasId(canvasId)) {
    return c.redirect('/canvases?message=Invalid canvas identifier');
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    return c.redirect('/canvases?message=Canvas not found');
  }

  if (canvas.user_id !== auth.user.id) {
    return c.redirect('/canvases?message=You can only delete your own canvases');
  }

  // Delete from ATProto first if synced
  if (canvas.uri && canvas.rkey) {
    try {
      const agent = await getAuthenticatedAgent(auth.session, auth.user);
      if (agent) {
        await deleteCanvasFromATProto(agent, auth.user, canvas);
      }
    } catch (error) {
      console.error('Error deleting canvas from ATProto:', error);
      // Continue with local deletion even if ATProto delete fails
    }
  }

  db.deleteCanvas(canvasId);
  return c.redirect('/canvases?message=Canvas deleted successfully');
});

// Publish canvas to ATProto (Leaflet format)
canvases.post('/canvases/:id/publish', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const canvasId = c.req.param('id');
  const csrfToken = getCsrfToken(getCookie(c, 'session'));

  if (!isValidCanvasId(canvasId)) {
    return c.html(errorPage({ handle: auth.user.handle, csrfToken }, 'Invalid canvas identifier'), 400);
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    return c.html(notFoundPage({ handle: auth.user.handle, csrfToken }), 404);
  }

  if (canvas.user_id !== auth.user.id) {
    return c.html(errorPage({ handle: auth.user.handle, csrfToken }, 'You do not own this canvas'), 403);
  }

  // Get authenticated agent
  const agent = await getAuthenticatedAgent(auth.session, auth.user);
  if (!agent) {
    return c.html(errorPage({ handle: auth.user.handle, csrfToken }, 'Unable to authenticate with ATProto. Please log in again.'), 401);
  }

  // Publish the canvas
  const result = await publishCanvas(agent, auth.user, { canvasId });

  if (!result.success) {
    return c.html(errorPage({ handle: auth.user.handle, csrfToken }, result.error || 'Failed to publish canvas'), 500);
  }

  // Redirect to the published post
  if (result.document) {
    return c.redirect(`/posts/${auth.user.did}/${result.document.rkey}?message=Canvas published successfully to ATProto`);
  } else {
    return c.redirect(`/canvases?message=Canvas published successfully`);
  }
});

export default canvases;
