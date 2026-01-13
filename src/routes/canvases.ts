import { Router, Request, Response } from 'express';
import * as db from '../database/index.js';
import { getSessionUser, getAuthenticatedAgent } from '../services/auth.js';
import { publishCanvas } from '../services/posts.js';
import { getCsrfToken } from '../middleware/csrf.js';
import {
  canvasListPage,
  canvasEditorPage,
  createCanvasPage,
  notFoundPage,
  errorPage
} from '../views/pages.js';
import crypto from 'crypto';

const router = Router();
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

// Helper to extract string params safely
function getParam(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// Get current user from session
function getCurrentUser(req: Request): { user: db.User; session: db.Session } | null {
  const sessionToken = req.cookies?.session;
  if (!sessionToken) return null;
  return getSessionUser(sessionToken);
}

// List all canvases for current user
router.get('/canvases', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = (page - 1) * CANVASES_PER_PAGE;
  const csrfToken = getCsrfToken(req.cookies?.session);

  const canvases = db.getCanvasesByUser(auth.user.id, CANVASES_PER_PAGE + 1, offset);
  const hasMore = canvases.length > CANVASES_PER_PAGE;
  const displayCanvases = canvases.slice(0, CANVASES_PER_PAGE);

  res.send(canvasListPage(displayCanvases, page, hasMore, { handle: auth.user.handle, csrfToken }));
});

// Create canvas form
router.get('/canvases/new', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const csrfToken = getCsrfToken(req.cookies?.session);
  res.send(createCanvasPage({ handle: auth.user.handle, csrfToken }));
});

// Handle canvas creation
router.post('/canvases/new', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const { title } = req.body;
  const csrfToken = getCsrfToken(req.cookies?.session);

  if (!title || title.trim().length === 0) {
    res.send(createCanvasPage({ handle: auth.user.handle, csrfToken }, 'Title is required'));
    return;
  }

  if (title.length > 128) {
    res.send(createCanvasPage({ handle: auth.user.handle, csrfToken }, 'Title must be 128 characters or less'));
    return;
  }

  const canvasId = generateCanvasId();
  db.createCanvas(canvasId, auth.user.id, title.trim());

  res.redirect(`/canvases/${canvasId}`);
});

// View/edit a canvas
router.get('/canvases/:id', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const canvasId = getParam(req.params, 'id');
  const csrfToken = getCsrfToken(req.cookies?.session);

  if (!isValidCanvasId(canvasId)) {
    res.status(400).send(errorPage({ handle: auth.user.handle, csrfToken }, 'Invalid canvas identifier'));
    return;
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    res.status(404).send(notFoundPage({ handle: auth.user.handle, csrfToken }));
    return;
  }

  // Check ownership
  if (canvas.user_id !== auth.user.id) {
    res.status(403).send(errorPage({ handle: auth.user.handle, csrfToken }, 'You do not have access to this canvas'));
    return;
  }

  res.send(canvasEditorPage(canvas, { handle: auth.user.handle, csrfToken }));
});

// API: Get canvas data
router.get('/api/canvases/:id', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const canvasId = getParam(req.params, 'id');

  if (!isValidCanvasId(canvasId)) {
    res.status(400).json({ error: 'Invalid canvas identifier' });
    return;
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    res.status(404).json({ error: 'Canvas not found' });
    return;
  }

  if (canvas.user_id !== auth.user.id) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json({
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
router.put('/api/canvases/:id', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const canvasId = getParam(req.params, 'id');

  if (!isValidCanvasId(canvasId)) {
    res.status(400).json({ error: 'Invalid canvas identifier' });
    return;
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    res.status(404).json({ error: 'Canvas not found' });
    return;
  }

  if (canvas.user_id !== auth.user.id) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { title, blocks, width, height } = req.body;
  const updates: { title?: string; blocks?: string; width?: number; height?: number } = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    if (title.length > 128) {
      res.status(400).json({ error: 'Title must be 128 characters or less' });
      return;
    }
    updates.title = title.trim();
  }

  if (blocks !== undefined) {
    if (!Array.isArray(blocks)) {
      res.status(400).json({ error: 'Blocks must be an array' });
      return;
    }
    updates.blocks = JSON.stringify(blocks);
  }

  if (width !== undefined) {
    if (typeof width !== 'number' || width < 100 || width > 10000) {
      res.status(400).json({ error: 'Width must be between 100 and 10000' });
      return;
    }
    updates.width = width;
  }

  if (height !== undefined) {
    if (typeof height !== 'number' || height < 100 || height > 10000) {
      res.status(400).json({ error: 'Height must be between 100 and 10000' });
      return;
    }
    updates.height = height;
  }

  db.updateCanvas(canvasId, updates);
  const updatedCanvas = db.getCanvasById(canvasId)!;

  res.json({
    id: updatedCanvas.id,
    title: updatedCanvas.title,
    blocks: JSON.parse(updatedCanvas.blocks),
    width: updatedCanvas.width,
    height: updatedCanvas.height,
    created_at: updatedCanvas.created_at,
    updated_at: updatedCanvas.updated_at
  });
});

// Handle canvas deletion
router.post('/canvases/:id/delete', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const canvasId = getParam(req.params, 'id');

  if (!isValidCanvasId(canvasId)) {
    res.redirect('/canvases?message=Invalid canvas identifier');
    return;
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    res.redirect('/canvases?message=Canvas not found');
    return;
  }

  if (canvas.user_id !== auth.user.id) {
    res.redirect('/canvases?message=You can only delete your own canvases');
    return;
  }

  db.deleteCanvas(canvasId);
  res.redirect('/canvases?message=Canvas deleted successfully');
});

// Publish canvas to ATProto (Leaflet format)
router.post('/canvases/:id/publish', async (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const canvasId = getParam(req.params, 'id');
  const csrfToken = getCsrfToken(req.cookies?.session);

  if (!isValidCanvasId(canvasId)) {
    res.status(400).send(errorPage({ handle: auth.user.handle, csrfToken }, 'Invalid canvas identifier'));
    return;
  }

  const canvas = db.getCanvasById(canvasId);
  if (!canvas) {
    res.status(404).send(notFoundPage({ handle: auth.user.handle, csrfToken }));
    return;
  }

  if (canvas.user_id !== auth.user.id) {
    res.status(403).send(errorPage({ handle: auth.user.handle, csrfToken }, 'You do not own this canvas'));
    return;
  }

  // Get authenticated agent
  const agent = await getAuthenticatedAgent(auth.session, auth.user);
  if (!agent) {
    res.status(401).send(errorPage({ handle: auth.user.handle, csrfToken }, 'Unable to authenticate with ATProto. Please log in again.'));
    return;
  }

  // Publish the canvas
  const result = await publishCanvas(agent, auth.user, { canvasId });

  if (!result.success) {
    res.status(500).send(errorPage({ handle: auth.user.handle, csrfToken }, result.error || 'Failed to publish canvas'));
    return;
  }

  // Redirect to the published post
  if (result.document) {
    res.redirect(`/posts/${auth.user.did}/${result.document.rkey}?message=Canvas published successfully to ATProto`);
  } else {
    res.redirect(`/canvases?message=Canvas published successfully`);
  }
});

export default router;
