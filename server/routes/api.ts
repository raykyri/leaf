import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import crypto from 'crypto';
import * as db from '../database/index.ts';
import { getSessionUser, getAuthenticatedAgent, authenticateUser } from '../services/auth.ts';
import { indexUserPDS } from '../services/indexer.ts';
import { createPost, updatePost, deletePost, publishCanvas } from '../services/posts.ts';
import { saveCanvasToATProto, deleteCanvasFromATProto } from '../services/canvas.ts';
import { getCsrfToken } from '../middleware/csrf.ts';
import { renderDocumentContent } from '../services/renderer.ts';
import { createPostLimiter } from '../middleware/rateLimit.ts';

const api = new Hono();
const ITEMS_PER_PAGE = 20;

// Validation functions
function isValidDid(did: string | undefined): did is string {
  if (typeof did !== 'string') return false;
  return /^did:(plc|web):[a-zA-Z0-9._:-]+$/.test(did) && did.length <= 2048;
}

function isValidRkey(rkey: string | undefined): rkey is string {
  if (typeof rkey !== 'string') return false;
  return /^[a-zA-Z0-9._~-]+$/.test(rkey) && rkey.length <= 512;
}

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

// Generate a unique canvas ID
function generateCanvasId(): string {
  return crypto.randomBytes(8).toString('hex');
}

// ============ Auth API ============

// Get current user
api.get('/auth/me', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ user: null, csrfToken: null }, 200);
  }

  const csrfToken = getCsrfToken(getCookie(c, 'session'));
  return c.json({
    user: {
      did: auth.user.did,
      handle: auth.user.handle,
      displayName: auth.user.display_name,
    },
    csrfToken,
  });
});

// Login with app password
api.post('/auth/login', async (c) => {
  const body = await c.req.json();
  const { handle, password } = body;

  if (!handle || !password) {
    return c.json({ error: 'Handle and password are required' }, 400);
  }

  try {
    const result = await authenticateUser(handle, password);
    if (!result.success || !result.session) {
      return c.json({ error: result.error || 'Authentication failed' }, 401);
    }

    setCookie(c, 'session', result.session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return c.json({
      user: {
        did: result.user!.did,
        handle: result.user!.handle,
        displayName: result.user!.display_name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Logout
api.post('/auth/logout', (c) => {
  const sessionToken = getCookie(c, 'session');
  if (sessionToken) {
    db.deleteSession(sessionToken);
  }
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ success: true });
});

// ============ Posts API ============

// List all posts
api.get('/posts', (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const allPosts = db.getAllDocuments(ITEMS_PER_PAGE + 1, offset);
  const hasMore = allPosts.length > ITEMS_PER_PAGE;
  const posts = allPosts.slice(0, ITEMS_PER_PAGE);

  return c.json({
    posts: posts.map((p) => ({
      author: p.author,
      rkey: p.rkey,
      title: p.title,
      description: p.description,
      published_at: p.published_at,
      handle: p.handle,
      display_name: p.display_name,
    })),
    page,
    hasMore,
  });
});

// Get a single post
api.get('/posts/:did/:rkey', (c) => {
  const did = c.req.param('did');
  const rkey = c.req.param('rkey');

  if (!isValidDid(did) || !isValidRkey(rkey)) {
    return c.json({ error: 'Invalid post identifier' }, 400);
  }

  const document = db.getDocumentByDidAndRkey(did, rkey);
  if (!document) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const author = db.getUserById(document.user_id);
  if (!author) {
    return c.json({ error: 'Author not found' }, 404);
  }

  // Extract plain text content for editing
  let plainTextContent = '';
  try {
    const pages = JSON.parse(document.content);
    if (Array.isArray(pages)) {
      const paragraphs: string[] = [];
      for (const page of pages) {
        if (page.blocks && Array.isArray(page.blocks)) {
          for (const blockWrapper of page.blocks) {
            const block = blockWrapper.block || blockWrapper;
            if (block.plaintext) {
              paragraphs.push(block.plaintext);
            }
          }
        }
      }
      plainTextContent = paragraphs.join('\n\n');
    }
  } catch {
    plainTextContent = '';
  }

  return c.json({
    post: {
      author: document.author,
      rkey: document.rkey,
      title: document.title,
      description: document.description,
      content: document.content,
      published_at: document.published_at,
    },
    author: {
      did: author.did,
      handle: author.handle,
      display_name: author.display_name,
    },
    renderedContent: renderDocumentContent(document.content),
    plainTextContent,
  });
});

// Create a post
api.post('/posts', createPostLimiter, async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { title, description, content } = body;

  if (!title || !content) {
    return c.json({ error: 'Title and content are required' }, 400);
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      return c.json({ error: 'Failed to connect to your PDS. Please log in again.' }, 401);
    }

    const result = await createPost(agent, auth.user, {
      title,
      content,
      description: description || undefined,
    });

    if (!result.success) {
      return c.json({ error: result.error || 'Failed to create post' }, 500);
    }

    return c.json({
      author: auth.user.did,
      rkey: result.document!.rkey,
    });
  } catch (error) {
    console.error('Error creating post:', error);
    return c.json({ error: 'An error occurred while creating your post' }, 500);
  }
});

// Update a post
api.put('/posts/:did/:rkey', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const did = c.req.param('did');
  const rkey = c.req.param('rkey');

  if (!isValidDid(did) || !isValidRkey(rkey)) {
    return c.json({ error: 'Invalid post identifier' }, 400);
  }

  if (auth.user.did !== did) {
    return c.json({ error: 'You can only edit your own posts' }, 403);
  }

  const document = db.getDocumentByDidAndRkey(did, rkey);
  if (!document) {
    return c.json({ error: 'Post not found' }, 404);
  }

  const body = await c.req.json();
  const { title, description, content } = body;

  if (!title || !content) {
    return c.json({ error: 'Title and content are required' }, 400);
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      return c.json({ error: 'Failed to connect to your PDS. Please log in again.' }, 401);
    }

    const result = await updatePost(agent, auth.user, rkey, {
      title,
      content,
      description: description || undefined,
    });

    if (!result.success) {
      return c.json({ error: result.error || 'Failed to update post' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating post:', error);
    return c.json({ error: 'An error occurred while updating your post' }, 500);
  }
});

// Delete a post
api.delete('/posts/:did/:rkey', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const did = c.req.param('did');
  const rkey = c.req.param('rkey');

  if (!isValidDid(did) || !isValidRkey(rkey)) {
    return c.json({ error: 'Invalid post identifier' }, 400);
  }

  if (auth.user.did !== did) {
    return c.json({ error: 'You can only delete your own posts' }, 403);
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      return c.json({ error: 'Failed to connect to PDS' }, 401);
    }

    const result = await deletePost(agent, auth.user, rkey);
    if (!result.success) {
      return c.json({ error: result.error || 'Failed to delete post' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return c.json({ error: 'Error deleting post' }, 500);
  }
});

// ============ Profile API ============

// Get profile posts
api.get('/profile/posts', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const userPosts = db.getDocumentsByUser(auth.user.id, ITEMS_PER_PAGE + 1, offset);
  const hasMore = userPosts.length > ITEMS_PER_PAGE;
  const posts = userPosts.slice(0, ITEMS_PER_PAGE);

  return c.json({
    posts: posts.map((p) => ({
      author: p.author,
      rkey: p.rkey,
      title: p.title,
      description: p.description,
      published_at: p.published_at,
    })),
    page,
    hasMore,
  });
});

// Update profile
api.put('/profile', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { displayName } = body;

  const trimmedName = (displayName || '').trim();
  if (trimmedName.length > 64) {
    return c.json({ error: 'Display name must be 64 characters or less' }, 400);
  }

  try {
    const newDisplayName = trimmedName || null;
    db.updateUserDisplayName(auth.user.id, newDisplayName);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return c.json({ error: 'Failed to update profile' }, 500);
  }
});

// Refresh posts from PDS
api.post('/refresh', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      return c.json({ error: 'Failed to connect to PDS' }, 401);
    }

    const result = await indexUserPDS(auth.user, agent);
    return c.json({
      success: true,
      documents: result.documents,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error('Error refreshing from PDS:', error);
    return c.json({ error: 'Error refreshing from PDS' }, 500);
  }
});

// ============ Users API ============

// Get user posts
api.get('/users/:handle/posts', (c) => {
  const handle = c.req.param('handle');
  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  if (!handle) {
    return c.json({ error: 'Handle is required' }, 400);
  }

  const user = db.getUserByHandle(handle);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const userPosts = db.getDocumentsByUser(user.id, ITEMS_PER_PAGE + 1, offset);
  const hasMore = userPosts.length > ITEMS_PER_PAGE;
  const posts = userPosts.slice(0, ITEMS_PER_PAGE);

  return c.json({
    user: {
      handle: user.handle,
      display_name: user.display_name,
    },
    posts: posts.map((p) => ({
      author: p.author,
      rkey: p.rkey,
      title: p.title,
      description: p.description,
      published_at: p.published_at,
    })),
    page,
    hasMore,
  });
});

// ============ Canvases API ============

// List canvases
api.get('/canvases', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const offset = (page - 1) * ITEMS_PER_PAGE;

  const userCanvases = db.getCanvasesByUser(auth.user.id, ITEMS_PER_PAGE + 1, offset);
  const hasMore = userCanvases.length > ITEMS_PER_PAGE;
  const canvases = userCanvases.slice(0, ITEMS_PER_PAGE);

  return c.json({
    canvases: canvases.map((c) => ({
      id: c.id,
      title: c.title,
      width: c.width,
      height: c.height,
      updated_at: c.updated_at,
    })),
    page,
    hasMore,
  });
});

// Create canvas
api.post('/canvases', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { title } = body;

  if (!title || title.trim().length === 0) {
    return c.json({ error: 'Title is required' }, 400);
  }

  if (title.length > 128) {
    return c.json({ error: 'Title must be 128 characters or less' }, 400);
  }

  const canvasId = generateCanvasId();
  db.createCanvas(canvasId, auth.user.id, title.trim());

  return c.json({ id: canvasId });
});

// Get canvas
api.get('/canvases/:id', (c) => {
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
    blocks: canvas.blocks,
    width: canvas.width,
    height: canvas.height,
    created_at: canvas.created_at,
    updated_at: canvas.updated_at,
  });
});

// Update canvas
api.put('/canvases/:id', async (c) => {
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
      }
    } else {
      syncError = 'Unable to authenticate with ATProto';
    }
  } catch (error) {
    syncError = error instanceof Error ? error.message : 'ATProto sync failed';
  }

  return c.json({
    id: updatedCanvas.id,
    title: updatedCanvas.title,
    blocks: JSON.parse(updatedCanvas.blocks),
    width: updatedCanvas.width,
    height: updatedCanvas.height,
    updated_at: updatedCanvas.updated_at,
    synced: !syncError,
    syncError,
  });
});

// Delete canvas
api.delete('/canvases/:id', async (c) => {
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

  // Delete from ATProto first if synced
  if (canvas.uri && canvas.rkey) {
    try {
      const agent = await getAuthenticatedAgent(auth.session, auth.user);
      if (agent) {
        await deleteCanvasFromATProto(agent, auth.user, canvas);
      }
    } catch (error) {
      console.error('Error deleting canvas from ATProto:', error);
    }
  }

  db.deleteCanvas(canvasId);
  return c.json({ success: true });
});

// Publish canvas
api.post('/canvases/:id/publish', async (c) => {
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

  const agent = await getAuthenticatedAgent(auth.session, auth.user);
  if (!agent) {
    return c.json({ error: 'Unable to authenticate with ATProto' }, 401);
  }

  const result = await publishCanvas(agent, auth.user, { canvasId });

  if (!result.success) {
    return c.json({ error: result.error || 'Failed to publish canvas' }, 500);
  }

  return c.json({
    success: true,
    author: auth.user.did,
    rkey: result.document?.rkey,
  });
});

export default api;
