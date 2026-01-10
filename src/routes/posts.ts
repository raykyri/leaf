import { Router, Request, Response } from 'express';
import * as db from '../database/index.js';
import { getSessionUser, getAuthenticatedAgent } from '../services/auth.js';
import { indexUserPDS } from '../services/indexer.js';
import { createPost } from '../services/posts.js';
import { getCsrfToken } from '../middleware/csrf.js';
import {
  postsListPage,
  postPage,
  userPostsPage,
  profilePage,
  createPostPage,
  notFoundPage
} from '../views/pages.js';

const router = Router();
const POSTS_PER_PAGE = 20;

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
  const { did, rkey } = req.params;
  const csrfToken = getCsrfToken(req.cookies?.session);

  // Try to find the document
  const document = db.getDocumentByDidAndRkey(did, rkey);

  if (!document) {
    const currentUser = getCurrentUser(req);
    res.status(404).send(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
    return;
  }

  // Get author info
  const author = db.getUserById(document.user_id);
  if (!author) {
    const currentUser = getCurrentUser(req);
    res.status(404).send(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
    return;
  }

  const currentUser = getCurrentUser(req);

  res.send(postPage(document, author, currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
});

// View posts by a specific user
router.get('/user/:handle', (req: Request, res: Response) => {
  const { handle } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;
  const csrfToken = getCsrfToken(req.cookies?.session);

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

// Handle post creation
router.post('/create', async (req: Request, res: Response) => {
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

export default router;
