import { Router, Request, Response } from 'express';
import * as db from '../database/index.js';
import { getSessionUser, getAuthenticatedAgent } from '../services/auth.js';
import { indexUserPDS } from '../services/indexer.js';
import { createPost, deletePost } from '../services/posts.js';
import { getCsrfToken } from '../middleware/csrf.js';
import { createPostLimiter } from '../middleware/rateLimit.js';
import {
  postsListPage,
  postPage,
  userPostsPage,
  profilePage,
  createPostPage,
  editProfilePage,
  notFoundPage,
  errorPage
} from '../views/pages.js';

const router = Router();
const POSTS_PER_PAGE = 20;

// Validation functions
function isValidDid(did: string | undefined): did is string {
  if (typeof did !== 'string') return false;
  return /^did:(plc|web):[a-zA-Z0-9._:-]+$/.test(did) && did.length <= 2048;
}

function isValidRkey(rkey: string | undefined): rkey is string {
  if (typeof rkey !== 'string') return false;
  return /^[a-zA-Z0-9._~-]+$/.test(rkey) && rkey.length <= 512;
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

// List all posts
router.get('/posts', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;

  const posts = db.getAllDocuments(POSTS_PER_PAGE + 1, offset);
  const hasMore = posts.length > POSTS_PER_PAGE;
  const displayPosts = posts.slice(0, POSTS_PER_PAGE);

  const currentUser = getCurrentUser(req);
  const csrfToken = getCsrfToken(req.cookies?.session);

  res.send(postsListPage(
    displayPosts,
    page,
    hasMore,
    currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined
  ));
});

// View a single post
router.get('/posts/:did/:rkey', (req: Request, res: Response) => {
  const did = getParam(req.params, 'did');
  const rkey = getParam(req.params, 'rkey');
  const csrfToken = getCsrfToken(req.cookies?.session);
  const currentUser = getCurrentUser(req);

  // Validate input parameters
  if (!isValidDid(did) || !isValidRkey(rkey)) {
    res.status(400).send(errorPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined, 'Invalid post identifier'));
    return;
  }

  // Try to find the document
  const document = db.getDocumentByDidAndRkey(did, rkey);

  if (!document) {
    res.status(404).send(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
    return;
  }

  // Get author info
  const author = db.getUserById(document.user_id);
  if (!author) {
    res.status(404).send(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
    return;
  }

  // Check if current user owns this post
  const isOwner = currentUser?.user.id === author.id;

  res.send(postPage(document, author, currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined, isOwner));
});

// View posts by a specific user
router.get('/user/:handle', (req: Request, res: Response) => {
  const handle = getParam(req.params, 'handle');
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;
  const csrfToken = getCsrfToken(req.cookies?.session);

  if (!handle) {
    const currentUser = getCurrentUser(req);
    res.status(404).send(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
    return;
  }

  const author = db.getUserByHandle(handle);
  if (!author) {
    const currentUser = getCurrentUser(req);
    res.status(404).send(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
    return;
  }

  const posts = db.getDocumentsByUser(author.id, POSTS_PER_PAGE + 1, offset);
  const hasMore = posts.length > POSTS_PER_PAGE;
  const displayPosts = posts.slice(0, POSTS_PER_PAGE);

  const currentUser = getCurrentUser(req);

  res.send(userPostsPage(author, displayPosts, page, hasMore, currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
});

// Profile page (authenticated user's posts)
router.get('/profile', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;
  const message = req.query.message as string | undefined;
  const csrfToken = getCsrfToken(req.cookies?.session);

  const posts = db.getDocumentsByUser(auth.user.id, POSTS_PER_PAGE + 1, offset);
  const hasMore = posts.length > POSTS_PER_PAGE;
  const displayPosts = posts.slice(0, POSTS_PER_PAGE);

  res.send(profilePage(auth.user, displayPosts, page, hasMore, csrfToken, message));
});

// Edit profile page
router.get('/profile/edit', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const csrfToken = getCsrfToken(req.cookies?.session);
  const message = req.query.message as string | undefined;
  const error = req.query.error as string | undefined;

  res.send(editProfilePage(auth.user, csrfToken, message, error));
});

// Handle profile update
router.post('/profile/edit', async (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const { display_name } = req.body;

  // Validate display name (allow empty to clear it)
  const trimmedName = (display_name || '').trim();
  if (trimmedName.length > 64) {
    res.redirect('/profile/edit?error=Display name must be 64 characters or less');
    return;
  }

  try {
    // Update local database
    const newDisplayName = trimmedName || null;
    db.updateUserDisplayName(auth.user.id, newDisplayName);

    // Optionally update on Bluesky (if they want to sync)
    // For now, just update locally - users can update their Bluesky profile separately

    res.redirect('/profile/edit?message=Profile updated successfully');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.redirect('/profile/edit?error=Failed to update profile');
  }
});

// Refresh user's posts from PDS
router.post('/refresh', async (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      res.redirect('/profile?message=Failed to connect to PDS');
      return;
    }

    const result = await indexUserPDS(auth.user, agent);
    res.redirect(`/profile?message=Indexed ${result.documents} documents`);
  } catch (error) {
    console.error('Error refreshing from PDS:', error);
    res.redirect('/profile?message=Error refreshing from PDS');
  }
});

// Create post form
router.get('/create', (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const csrfToken = getCsrfToken(req.cookies?.session);
  res.send(createPostPage(auth.user, csrfToken));
});

// Handle post creation (with rate limiting)
router.post('/create', createPostLimiter, async (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const { title, description, content } = req.body;
  const csrfToken = getCsrfToken(req.cookies?.session);

  if (!title || !content) {
    res.send(createPostPage(auth.user, csrfToken, 'Title and content are required'));
    return;
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      res.send(createPostPage(auth.user, csrfToken, 'Failed to connect to your PDS. Please log in again.'));
      return;
    }

    const result = await createPost(agent, auth.user, {
      title,
      content,
      description: description || undefined
    });

    if (!result.success) {
      res.send(createPostPage(auth.user, csrfToken, result.error || 'Failed to create post'));
      return;
    }

    // Redirect to the new post
    res.redirect(`/posts/${encodeURIComponent(auth.user.did)}/${encodeURIComponent(result.document!.rkey)}`);
  } catch (error) {
    console.error('Error creating post:', error);
    res.send(createPostPage(auth.user, csrfToken, 'An error occurred while creating your post'));
  }
});

// Handle post deletion
router.post('/posts/:did/:rkey/delete', async (req: Request, res: Response) => {
  const auth = getCurrentUser(req);
  if (!auth) {
    res.redirect('/');
    return;
  }

  const did = getParam(req.params, 'did');
  const rkey = getParam(req.params, 'rkey');

  // Validate input parameters
  if (!isValidDid(did) || !isValidRkey(rkey)) {
    res.redirect('/profile?message=Invalid post identifier');
    return;
  }

  // Verify the user owns this post
  if (auth.user.did !== did) {
    res.redirect('/profile?message=You can only delete your own posts');
    return;
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      res.redirect('/profile?message=Failed to connect to PDS');
      return;
    }

    const result = await deletePost(agent, auth.user, rkey);

    if (!result.success) {
      res.redirect(`/profile?message=${encodeURIComponent(result.error || 'Failed to delete post')}`);
      return;
    }

    res.redirect('/profile?message=Post deleted successfully');
  } catch (error) {
    console.error('Error deleting post:', error);
    res.redirect('/profile?message=Error deleting post');
  }
});

export default router;
