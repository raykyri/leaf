import { layout, escapeHtml, OpenGraphMeta } from './layout.js';
import { renderDocumentContent } from '../services/renderer.js';
import type { Document, User } from '../database/index.js';

export function loginPage(error?: string): string {
  const content = `
    <div class="card">
      <h2>Login / Sign Up</h2>
      <p style="margin-bottom: 1rem; color: var(--text-muted);">
        Use your Bluesky handle and an app password to sign in.
        If you don't have an account yet, signing in will create one.
      </p>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <form action="/auth/login" method="POST">
        <div>
          <label for="handle">Handle</label>
          <input type="text" id="handle" name="handle" placeholder="@username.bsky.social" required>
        </div>
        <div>
          <label for="password">App Password</label>
          <input type="password" id="password" name="password" required>
          <p class="hint">Create an app password at <a href="https://bsky.app/settings/app-passwords" target="_blank">bsky.app/settings/app-passwords</a></p>
        </div>
        <button type="submit">Sign In</button>
      </form>
    </div>
    <script>
      document.addEventListener('keydown', function(e) {
        if (e.altKey || e.metaKey || e.ctrlKey) {
          e.preventDefault();
        }
      });
    </script>
  `;

  return layout('Login', content);
}

export function postsListPage(
  posts: (Document & { handle: string; display_name: string | null })[],
  page: number,
  hasMore: boolean,
  user?: { handle: string; csrfToken?: string }
): string {
  const postCards = posts.length === 0
    ? '<div class="empty-state"><p>No posts yet. Be the first to create one!</p></div>'
    : posts.map(post => `
        <article class="card">
          <h2 class="post-title">
            <a href="/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}">
              ${escapeHtml(post.title)}
            </a>
          </h2>
          <div class="post-meta">
            by <a href="/user/${encodeURIComponent(post.handle)}">${escapeHtml(post.display_name || post.handle)}</a>
            ${post.published_at ? `• ${formatDate(post.published_at)}` : ''}
          </div>
          ${post.description ? `<p class="post-excerpt">${escapeHtml(post.description)}</p>` : ''}
        </article>
      `).join('');

  const pagination = `
    <div class="pagination">
      ${page > 1 ? `<a href="/posts?page=${page - 1}">&larr; Previous</a>` : ''}
      ${hasMore ? `<a href="/posts?page=${page + 1}">Next &rarr;</a>` : ''}
    </div>
  `;

  const content = `
    <h1 style="margin-bottom: 1.5rem;">All Posts</h1>
    ${postCards}
    ${posts.length > 0 ? pagination : ''}
  `;

  return layout('All Posts', content, user);
}

export function postPage(
  post: Document,
  author: { handle: string; display_name: string | null; did?: string },
  user?: { handle: string; csrfToken?: string },
  isOwner?: boolean
): string {
  const renderedContent = renderDocumentContent(post.content);

  const deleteButton = isOwner && user?.csrfToken ? `
    <form action="/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}/delete" method="POST" class="inline-form" onsubmit="return confirm('Are you sure you want to delete this post? This cannot be undone.');">
      <input type="hidden" name="_csrf" value="${escapeHtml(user.csrfToken)}">
      <button type="submit" class="danger-btn">Delete Post</button>
    </form>
  ` : '';

  const content = `
    <article>
      <header style="margin-bottom: 2rem;">
        <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">${escapeHtml(post.title)}</h1>
        <div class="post-meta">
          by <a href="/user/${encodeURIComponent(author.handle)}">${escapeHtml(author.display_name || author.handle)}</a>
          ${post.published_at ? `• ${formatDate(post.published_at)}` : ''}
        </div>
        ${post.description ? `<p style="color: var(--text-muted); margin-top: 0.5rem;">${escapeHtml(post.description)}</p>` : ''}
      </header>
      <div class="post-content">
        ${renderedContent}
      </div>
    </article>
    <div class="post-actions">
      <a href="/posts">&larr; Back to all posts</a>
      ${deleteButton}
    </div>
  `;

  // OpenGraph metadata for the post
  const og: OpenGraphMeta = {
    title: post.title,
    description: post.description || `A post by ${author.display_name || author.handle}`,
    type: 'article',
    author: author.display_name || author.handle,
    publishedTime: post.published_at || undefined
  };

  return layout(post.title, content, user, og);
}

export function userPostsPage(
  author: User,
  posts: Document[],
  page: number,
  hasMore: boolean,
  currentUser?: { handle: string; csrfToken?: string }
): string {
  const postCards = posts.length === 0
    ? '<div class="empty-state"><p>No posts from this user yet.</p></div>'
    : posts.map(post => `
        <article class="card">
          <h2 class="post-title">
            <a href="/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}">
              ${escapeHtml(post.title)}
            </a>
          </h2>
          <div class="post-meta">
            ${post.published_at ? formatDate(post.published_at) : ''}
          </div>
          ${post.description ? `<p class="post-excerpt">${escapeHtml(post.description)}</p>` : ''}
        </article>
      `).join('');

  const pagination = `
    <div class="pagination">
      ${page > 1 ? `<a href="/user/${encodeURIComponent(author.handle)}?page=${page - 1}">&larr; Previous</a>` : ''}
      ${hasMore ? `<a href="/user/${encodeURIComponent(author.handle)}?page=${page + 1}">Next &rarr;</a>` : ''}
    </div>
  `;

  const content = `
    <h1 style="margin-bottom: 0.5rem;">${escapeHtml(author.display_name || author.handle)}</h1>
    <p style="color: var(--text-muted); margin-bottom: 1.5rem;">@${escapeHtml(author.handle)}</p>
    ${postCards}
    ${posts.length > 0 ? pagination : ''}
  `;

  const og: OpenGraphMeta = {
    title: `Posts by ${author.display_name || author.handle}`,
    description: `View blog posts by @${author.handle} on Leaflet Blog`,
    type: 'website'
  };

  return layout(`Posts by ${author.display_name || author.handle}`, content, currentUser, og);
}

export function profilePage(
  user: User,
  posts: Document[],
  page: number,
  hasMore: boolean,
  csrfToken: string,
  message?: string
): string {
  const postCards = posts.length === 0
    ? '<div class="empty-state"><p>You haven\'t created any posts yet. <a href="/create">Create your first post!</a></p></div>'
    : posts.map(post => `
        <article class="card">
          <h2 class="post-title">
            <a href="/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}">
              ${escapeHtml(post.title)}
            </a>
          </h2>
          <div class="post-meta">
            ${post.published_at ? formatDate(post.published_at) : ''}
          </div>
          ${post.description ? `<p class="post-excerpt">${escapeHtml(post.description)}</p>` : ''}
        </article>
      `).join('');

  const pagination = `
    <div class="pagination">
      ${page > 1 ? `<a href="/profile?page=${page - 1}">&larr; Previous</a>` : ''}
      ${hasMore ? `<a href="/profile?page=${page + 1}">Next &rarr;</a>` : ''}
    </div>
  `;

  const content = `
    <h1 style="margin-bottom: 0.5rem;">${escapeHtml(user.display_name || 'My Posts')}</h1>
    <p style="color: var(--text-muted); margin-bottom: 1rem;">@${escapeHtml(user.handle)}</p>
    <div style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem;">
      <form action="/refresh" method="POST" class="inline-form">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
        <button type="submit" class="secondary-btn">Refresh from PDS</button>
      </form>
      <a href="/profile/edit" class="secondary-btn" style="text-decoration: none; display: inline-block;">Edit Profile</a>
    </div>
    ${message ? `<div class="success">${escapeHtml(message)}</div>` : ''}
    ${postCards}
    ${posts.length > 0 ? pagination : ''}
  `;

  return layout('My Posts', content, { handle: user.handle, csrfToken });
}

export function editProfilePage(
  user: User,
  csrfToken: string,
  message?: string,
  error?: string
): string {
  const content = `
    <div class="card">
      <h2>Edit Profile</h2>
      <p style="margin-bottom: 1rem; color: var(--text-muted);">
        Update your display name for this blog. Your handle (@${escapeHtml(user.handle)}) is managed through Bluesky.
      </p>
      ${message ? `<div class="success">${escapeHtml(message)}</div>` : ''}
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <form action="/profile/edit" method="POST">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
        <div>
          <label for="display_name">Display Name</label>
          <input type="text" id="display_name" name="display_name" maxlength="64" placeholder="Your display name" value="${escapeHtml(user.display_name || '')}">
          <p class="hint">Leave empty to use your handle as your display name</p>
        </div>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <button type="submit">Save Changes</button>
          <a href="/profile" style="color: var(--text-muted);">Cancel</a>
        </div>
      </form>
    </div>
  `;

  return layout('Edit Profile', content, { handle: user.handle, csrfToken });
}

export function createPostPage(user: { handle: string }, csrfToken: string, error?: string): string {
  const content = `
    <div class="card">
      <h2>Create New Post</h2>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
      <form action="/create" method="POST">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
        <div>
          <label for="title">Title</label>
          <input type="text" id="title" name="title" required maxlength="280">
        </div>
        <div>
          <label for="description">Description (optional)</label>
          <input type="text" id="description" name="description" maxlength="500" placeholder="A brief summary of your post">
        </div>
        <div>
          <label for="content">Content</label>
          <textarea id="content" name="content" required placeholder="Write your post content here...

Separate paragraphs with blank lines."></textarea>
        </div>
        <button type="submit">Publish Post</button>
      </form>
    </div>
  `;

  return layout('Create Post', content, { handle: user.handle, csrfToken });
}

export function notFoundPage(user?: { handle: string; csrfToken?: string }): string {
  const content = `
    <div class="empty-state">
      <h1>404 - Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <p><a href="/posts">Go to all posts</a></p>
    </div>
  `;

  return layout('Not Found', content, user);
}

export function errorPage(user?: { handle: string; csrfToken?: string }, message?: string): string {
  const displayMessage = message || 'Something went wrong. Please try again.';
  const content = `
    <div class="empty-state">
      <h1>Error</h1>
      <p>${escapeHtml(displayMessage)}</p>
      <p><a href="/">Go home</a></p>
    </div>
  `;

  return layout('Error', content, user);
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
