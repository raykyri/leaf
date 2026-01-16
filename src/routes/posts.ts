import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import * as db from '../database/index.ts';
import { getSessionUser, getAuthenticatedAgent } from '../services/auth.ts';
import { indexUserPDS } from '../services/indexer.ts';
import { createPost, deletePost } from '../services/posts.ts';
import { getCsrfToken } from '../middleware/csrf.ts';
import { createPostLimiter } from '../middleware/rateLimit.ts';
import {
  postsListPage,
  postPage,
  userPostsPage,
  profilePage,
  createPostPage,
  editProfilePage,
  notFoundPage,
  errorPage
} from '../views/pages.ts';

const posts = new Hono();
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

// Get current user from session
function getCurrentUser(c: Context): { user: db.User; session: db.Session } | null {
  const sessionToken = getCookie(c, 'session');
  if (!sessionToken) return null;
  return getSessionUser(sessionToken);
}

// List all posts
posts.get('/posts', (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;

  const allPosts = db.getAllDocuments(POSTS_PER_PAGE + 1, offset);
  const hasMore = allPosts.length > POSTS_PER_PAGE;
  const displayPosts = allPosts.slice(0, POSTS_PER_PAGE);

  const currentUser = getCurrentUser(c);
  const csrfToken = getCsrfToken(getCookie(c, 'session'));

  return c.html(postsListPage(
    displayPosts,
    page,
    hasMore,
    currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined
  ));
});

// View a single post
posts.get('/posts/:did/:rkey', (c) => {
  const did = c.req.param('did');
  const rkey = c.req.param('rkey');
  const csrfToken = getCsrfToken(getCookie(c, 'session'));
  const currentUser = getCurrentUser(c);

  // Validate input parameters
  if (!isValidDid(did) || !isValidRkey(rkey)) {
    return c.html(errorPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined, 'Invalid post identifier'), 400);
  }

  // Try to find the document
  const document = db.getDocumentByDidAndRkey(did, rkey);

  if (!document) {
    return c.html(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined), 404);
  }

  // Get author info
  const author = db.getUserById(document.user_id);
  if (!author) {
    return c.html(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined), 404);
  }

  // Check if current user owns this post
  const isOwner = currentUser?.user.id === author.id;

  return c.html(postPage(document, author, currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined, isOwner));
});

// View posts by a specific user
posts.get('/user/:handle', (c) => {
  const handle = c.req.param('handle');
  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;
  const csrfToken = getCsrfToken(getCookie(c, 'session'));

  if (!handle) {
    const currentUser = getCurrentUser(c);
    return c.html(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined), 404);
  }

  const author = db.getUserByHandle(handle);
  if (!author) {
    const currentUser = getCurrentUser(c);
    return c.html(notFoundPage(currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined), 404);
  }

  const userPosts = db.getDocumentsByUser(author.id, POSTS_PER_PAGE + 1, offset);
  const hasMore = userPosts.length > POSTS_PER_PAGE;
  const displayPosts = userPosts.slice(0, POSTS_PER_PAGE);

  const currentUser = getCurrentUser(c);

  return c.html(userPostsPage(author, displayPosts, page, hasMore, currentUser?.user ? { handle: currentUser.user.handle, csrfToken } : undefined));
});

// Profile page (authenticated user's posts)
posts.get('/profile', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1') || 1);
  const offset = (page - 1) * POSTS_PER_PAGE;
  const message = c.req.query('message');
  const csrfToken = getCsrfToken(getCookie(c, 'session'));

  const userPosts = db.getDocumentsByUser(auth.user.id, POSTS_PER_PAGE + 1, offset);
  const hasMore = userPosts.length > POSTS_PER_PAGE;
  const displayPosts = userPosts.slice(0, POSTS_PER_PAGE);

  return c.html(profilePage(auth.user, displayPosts, page, hasMore, csrfToken, message));
});

// Edit profile page
posts.get('/profile/edit', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const csrfToken = getCsrfToken(getCookie(c, 'session'));
  const message = c.req.query('message');
  const error = c.req.query('error');

  return c.html(editProfilePage(auth.user, csrfToken, message, error));
});

// Handle profile update
posts.post('/profile/edit', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const body = await c.req.parseBody();
  const display_name = body.display_name as string | undefined;

  // Validate display name (allow empty to clear it)
  const trimmedName = (display_name || '').trim();
  if (trimmedName.length > 64) {
    return c.redirect('/profile/edit?error=Display name must be 64 characters or less');
  }

  try {
    // Update local database
    const newDisplayName = trimmedName || null;
    db.updateUserDisplayName(auth.user.id, newDisplayName);

    // Optionally update on Bluesky (if they want to sync)
    // For now, just update locally - users can update their Bluesky profile separately

    return c.redirect('/profile/edit?message=Profile updated successfully');
  } catch (error) {
    console.error('Error updating profile:', error);
    return c.redirect('/profile/edit?error=Failed to update profile');
  }
});

// Refresh user's posts from PDS
posts.post('/refresh', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      return c.redirect('/profile?message=Failed to connect to PDS');
    }

    const result = await indexUserPDS(auth.user, agent);
    const deletedMsg = result.deleted > 0 ? `, removed ${result.deleted} orphaned` : '';
    return c.redirect(`/profile?message=Indexed ${result.documents} documents${deletedMsg}`);
  } catch (error) {
    console.error('Error refreshing from PDS:', error);
    return c.redirect('/profile?message=Error refreshing from PDS');
  }
});

// Create post form
posts.get('/create', (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const csrfToken = getCsrfToken(getCookie(c, 'session'));
  return c.html(createPostPage(auth.user, csrfToken));
});

// Handle post creation (with rate limiting)
posts.post('/create', createPostLimiter, async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const body = await c.req.parseBody();
  const title = body.title as string | undefined;
  const description = body.description as string | undefined;
  const content = body.content as string | undefined;
  const csrfToken = getCsrfToken(getCookie(c, 'session'));

  if (!title || !content) {
    return c.html(createPostPage(auth.user, csrfToken, 'Title and content are required'));
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      return c.html(createPostPage(auth.user, csrfToken, 'Failed to connect to your PDS. Please log in again.'));
    }

    const result = await createPost(agent, auth.user, {
      title,
      content,
      description: description || undefined
    });

    if (!result.success) {
      return c.html(createPostPage(auth.user, csrfToken, result.error || 'Failed to create post'));
    }

    // Redirect to the new post
    return c.redirect(`/posts/${encodeURIComponent(auth.user.did)}/${encodeURIComponent(result.document!.rkey)}`);
  } catch (error) {
    console.error('Error creating post:', error);
    return c.html(createPostPage(auth.user, csrfToken, 'An error occurred while creating your post'));
  }
});

// Handle post deletion
posts.post('/posts/:did/:rkey/delete', async (c) => {
  const auth = getCurrentUser(c);
  if (!auth) {
    return c.redirect('/');
  }

  const did = c.req.param('did');
  const rkey = c.req.param('rkey');

  // Validate input parameters
  if (!isValidDid(did) || !isValidRkey(rkey)) {
    return c.redirect('/profile?message=Invalid post identifier');
  }

  // Verify the user owns this post
  if (auth.user.did !== did) {
    return c.redirect('/profile?message=You can only delete your own posts');
  }

  try {
    const agent = await getAuthenticatedAgent(auth.session, auth.user);
    if (!agent) {
      return c.redirect('/profile?message=Failed to connect to PDS');
    }

    const result = await deletePost(agent, auth.user, rkey);

    if (!result.success) {
      return c.redirect(`/profile?message=${encodeURIComponent(result.error || 'Failed to delete post')}`);
    }

    return c.redirect('/profile?message=Post deleted successfully');
  } catch (error) {
    console.error('Error deleting post:', error);
    return c.redirect('/profile?message=Error deleting post');
  }
});

export default posts;
