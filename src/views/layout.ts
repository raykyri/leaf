// HTML layout templates

import { escapeHtml } from '../utils/html.ts';

export interface OpenGraphMeta {
  title?: string;
  description?: string;
  type?: 'website' | 'article';
  url?: string;
  author?: string;
  publishedTime?: string;
}

export function layout(
  title: string,
  content: string,
  user?: { handle: string; csrfToken?: string },
  og?: OpenGraphMeta
): string {
  const nav = user
    ? `
      <nav>
        <a href="/posts">All Posts</a>
        <a href="/profile">My Posts</a>
        <a href="/canvases">My Canvases</a>
        <a href="/create" class="secondary-btn">New Post</a>
        <form action="/auth/logout" method="POST" style="display: inline;">
          ${user.csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(user.csrfToken)}">` : ''}
          <button type="submit" class="logout-btn">Logout (${escapeHtml(user.handle)})</button>
        </form>
      </nav>
    `
    : `
      <nav>
        <a href="/posts">All Posts</a>
        <a href="/">Login</a>
      </nav>
    `;

  // Build OpenGraph meta tags
  const ogTitle = og?.title || title;
  const ogDescription = og?.description || 'A minimalist blogging platform built on AT Protocol';
  const ogType = og?.type || 'website';

  let ogTags = `
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="Leaflet">
  <meta name="description" content="${escapeHtml(ogDescription)}">`;

  if (og?.url) {
    ogTags += `\n  <meta property="og:url" content="${escapeHtml(og.url)}">`;
  }

  if (og?.author) {
    ogTags += `\n  <meta property="article:author" content="${escapeHtml(og.author)}">`;
  }

  if (og?.publishedTime) {
    ogTags += `\n  <meta property="article:published_time" content="${escapeHtml(og.publishedTime)}">`;
  }

  // Twitter Card tags
  ogTags += `
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Leaflet</title>
  ${ogTags}
  <style>
    /* Light theme (default) */
    :root {
      --primary: #ffffff;
      --secondary: #f7f7f7;
      --accent: #ff6719;
      --accent-hover: #e55a10;
      --text: #1a1a1a;
      --text-secondary: #292929;
      --text-muted: #6b6b6b;
      --bg: #ffffff;
      --card-bg: #ffffff;
      --border: #e7e7e7;
      --border-hover: #d0d0d0;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
      --success-bg: #f0fdf4;
      --success-border: #86efac;
      --success-text: #166534;
      --error-bg: #fef2f2;
      --error-border: #fca5a5;
      --error-text: #991b1b;
      --link: #ff6719;
      --code-bg: #f5f5f5;
      --blockquote-border: #ff6719;
    }

    /* Dark theme */
    [data-theme="dark"] {
      --primary: #0d0d0d;
      --secondary: #1a1a1a;
      --accent: #ff6719;
      --accent-hover: #ff8547;
      --text: #f0f0f0;
      --text-secondary: #e0e0e0;
      --text-muted: #888888;
      --bg: #0d0d0d;
      --card-bg: #1a1a1a;
      --border: #2a2a2a;
      --border-hover: #3a3a3a;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success-bg: #052e16;
      --success-border: #166534;
      --success-text: #86efac;
      --error-bg: #450a0a;
      --error-border: #991b1b;
      --error-text: #fca5a5;
      --link: #ff8547;
      --code-bg: #1f1f1f;
      --blockquote-border: #ff6719;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      color-scheme: light dark;
    }

    [data-theme="light"] {
      color-scheme: light;
    }

    [data-theme="dark"] {
      color-scheme: dark;
    }

    body {
      font-family: 'Akzidenz-Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      min-height: 100vh;
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    header {
      background: var(--primary);
      padding: 1.25rem 2rem;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-inner {
      max-width: 680px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    header h1 {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    header h1 a {
      color: var(--text);
      text-decoration: none;
    }

    header h1 a:hover {
      color: var(--accent);
    }

    nav {
      display: flex;
      gap: 1.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    nav a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.15s ease;
    }

    nav a:hover {
      color: var(--text);
    }

    .theme-toggle {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      font-size: 1.1rem;
    }

    .theme-toggle:hover {
      color: var(--text);
      background: var(--secondary);
    }

    .logout-btn, .secondary-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.4rem 0.9rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .logout-btn:hover, .secondary-btn:hover {
      border-color: var(--border-hover);
      color: var(--text);
      background: var(--secondary);
    }

    .danger-btn {
      background: transparent;
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 0.4rem 0.9rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .danger-btn:hover {
      background: var(--danger);
      color: white;
    }

    .primary-btn {
      background: var(--accent);
      border: none;
      color: white;
      padding: 0.75rem 1.75rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.15s ease;
    }

    .primary-btn:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    main {
      max-width: 680px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.75rem;
      margin-bottom: 1.5rem;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }

    .card:hover {
      border-color: var(--border-hover);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    [data-theme="dark"] .card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    /* Article header styling */
    .article-header {
      margin-bottom: 2.5rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    .article-title {
      font-size: 2.5rem;
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 1rem;
      color: var(--text);
    }

    .article-subtitle {
      font-size: 1.25rem;
      color: var(--text-muted);
      line-height: 1.5;
      margin-top: 0.75rem;
    }

    .article-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1.25rem;
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    .article-meta a {
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
    }

    .article-meta a:hover {
      color: var(--accent);
    }

    .article-meta .separator {
      color: var(--border);
    }

    .post-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      letter-spacing: -0.02em;
      line-height: 1.3;
    }

    .post-title a {
      color: var(--text);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .post-title a:hover {
      color: var(--accent);
    }

    .post-meta {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 0.75rem;
    }

    .post-meta a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .post-meta a:hover {
      color: var(--accent);
    }

    .post-excerpt {
      color: var(--text-secondary);
      font-size: 1.05rem;
      line-height: 1.7;
    }

    .post-content {
      line-height: 1.8;
      font-size: 1.125rem;
      color: var(--text-secondary);
    }

    .post-content p {
      margin-bottom: 1.5rem;
    }

    .post-content h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 2.5rem 0 1rem;
      line-height: 1.2;
      letter-spacing: -0.03em;
      color: var(--text);
    }

    .post-content h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 2rem 0 0.75rem;
      line-height: 1.3;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .post-content h3, .post-content h4, .post-content h5, .post-content h6 {
      font-weight: 600;
      margin: 1.75rem 0 0.75rem;
      line-height: 1.4;
      color: var(--text);
    }

    .post-content h3 { font-size: 1.25rem; }
    .post-content h4 { font-size: 1.125rem; }
    .post-content h5 { font-size: 1rem; }
    .post-content h6 { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; }

    .post-content blockquote {
      border-left: 3px solid var(--blockquote-border);
      padding: 0.25rem 0 0.25rem 1.5rem;
      margin: 1.75rem 0;
      color: var(--text-muted);
      font-style: italic;
      font-size: 1.2rem;
    }

    .post-content pre {
      background: var(--code-bg);
      padding: 1.25rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid var(--border);
    }

    .post-content code {
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      font-size: 0.9em;
    }

    .post-content p code, .post-content li code {
      background: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 4px;
    }

    .post-content ul, .post-content ol {
      margin: 1.5rem 0;
      padding-left: 1.75rem;
    }

    .post-content li {
      margin-bottom: 0.5rem;
    }

    .post-content a {
      color: var(--link);
      text-decoration: underline;
      text-underline-offset: 2px;
      text-decoration-thickness: 1px;
      transition: text-decoration-color 0.15s ease;
    }

    .post-content a:hover {
      text-decoration-thickness: 2px;
    }

    .post-content hr {
      border: none;
      height: 1px;
      background: var(--border);
      margin: 3rem 0;
    }

    .post-content figure {
      margin: 2rem 0;
    }

    .post-content .image-placeholder {
      background: var(--secondary);
      padding: 3rem;
      text-align: center;
      color: var(--text-muted);
      border-radius: 8px;
    }

    .post-content figcaption {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.75rem;
    }

    .website-embed, .bsky-embed {
      background: var(--secondary);
      padding: 1.25rem;
      border-radius: 8px;
      margin: 1.5rem 0;
      border: 1px solid var(--border);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    label {
      font-weight: 600;
      margin-bottom: 0.35rem;
      display: block;
      font-size: 0.95rem;
    }

    input, textarea {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-family: inherit;
      font-size: 1rem;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    input:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(255, 103, 25, 0.1);
    }

    textarea {
      min-height: 240px;
      resize: vertical;
      line-height: 1.7;
    }

    button[type="submit"] {
      background: var(--accent);
      color: white;
      border: none;
      padding: 0.875rem 1.75rem;
      border-radius: 20px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      align-self: flex-start;
    }

    button[type="submit"]:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    .error {
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      color: var(--error-text);
      padding: 1rem 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.25rem;
      font-size: 0.95rem;
    }

    .success {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: var(--success-text);
      padding: 1rem 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.25rem;
      font-size: 0.95rem;
    }

    .pagination {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 2.5rem;
    }

    .pagination a {
      color: var(--text-muted);
      text-decoration: none;
      padding: 0.6rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .pagination a:hover {
      border-color: var(--border-hover);
      background: var(--secondary);
      color: var(--text);
    }

    footer {
      text-align: center;
      padding: 2.5rem 1.5rem;
      color: var(--text-muted);
      font-size: 0.9rem;
      border-top: 1px solid var(--border);
      margin-top: 3rem;
    }

    footer a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    footer a:hover {
      color: var(--accent);
    }

    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 4rem 2rem;
    }

    .empty-state h1 {
      margin-bottom: 1rem;
      color: var(--text);
    }

    .empty-state a {
      color: var(--accent);
    }

    .hint {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 0.35rem;
    }

    .hint a {
      color: var(--accent);
    }

    .post-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      flex-wrap: wrap;
    }

    .post-actions a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.15s ease;
    }

    .post-actions a:hover {
      color: var(--accent);
    }

    .inline-form {
      display: inline;
    }

    .external-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.15s ease;
    }

    .external-link:hover {
      color: var(--accent);
    }

    .external-link::after {
      content: ' ↗';
      font-size: 0.8em;
    }

    /* Page title styling */
    h1.page-title {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 1.5rem;
      color: var(--text);
    }

    /* Selection styling */
    ::selection {
      background: rgba(255, 103, 25, 0.2);
      color: inherit;
    }

    /* Form card styling */
    .card h2 {
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
      color: var(--text);
    }

    .card > p {
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }

    /* Divider styling */
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 1.5rem 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid var(--border);
    }

    .divider span {
      padding: 0 1rem;
    }

    /* Author byline styling */
    .byline {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .byline-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1rem;
      color: var(--text-muted);
    }

    .byline-info {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .byline-name {
      font-weight: 600;
      color: var(--text);
    }

    .byline-date {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    /* Responsive adjustments */
    @media (max-width: 640px) {
      header {
        padding: 1rem;
      }

      .header-inner {
        flex-direction: column;
        gap: 0.75rem;
        align-items: flex-start;
      }

      nav {
        width: 100%;
        gap: 1rem;
      }

      main {
        padding: 2rem 1rem;
      }

      .card {
        padding: 1.25rem;
      }

      .post-title {
        font-size: 1.25rem;
      }

      .post-content {
        font-size: 1rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <h1><a href="/">Leaflet</a></h1>
      <div style="display: flex; align-items: center; gap: 1rem;">
        ${nav}
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
          <span class="theme-icon">☀️</span>
        </button>
      </div>
    </div>
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <p>Built on <a href="https://atproto.com" target="_blank">AT Protocol</a> using <a href="https://leaflet.pub" target="_blank">Leaflet</a></p>
  </footer>
  <script>
    (function() {
      const toggle = document.getElementById('theme-toggle');
      const icon = toggle.querySelector('.theme-icon');

      function getTheme() {
        const stored = localStorage.getItem('theme');
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
      }

      // Initialize
      setTheme(getTheme());

      toggle.addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
      });

      // Listen for system preference changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('theme')) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      });
    })();
  </script>
</body>
</html>`;
}

export { escapeHtml };

// Canvas-specific layout (full-width, includes canvas editor JS)
export function canvasLayout(
  title: string,
  content: string,
  user?: { handle: string; csrfToken?: string }
): string {
  const nav = user
    ? `
      <nav>
        <a href="/posts">All Posts</a>
        <a href="/profile">My Posts</a>
        <a href="/canvases">My Canvases</a>
        <a href="/create" class="secondary-btn">New Post</a>
        <form action="/auth/logout" method="POST" style="display: inline;">
          ${user.csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(user.csrfToken)}">` : ''}
          <button type="submit" class="logout-btn">Logout (${escapeHtml(user.handle)})</button>
        </form>
      </nav>
    `
    : `
      <nav>
        <a href="/posts">All Posts</a>
        <a href="/">Login</a>
      </nav>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Leaflet Canvas</title>
  <style>
    /* Light theme (default) */
    :root {
      --primary: #ffffff;
      --secondary: #f7f7f7;
      --accent: #ff6719;
      --accent-hover: #e55a10;
      --text: #1a1a1a;
      --text-secondary: #292929;
      --text-muted: #6b6b6b;
      --bg: #ffffff;
      --card-bg: #ffffff;
      --border: #e7e7e7;
      --border-hover: #d0d0d0;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
      --canvas-bg: #f0f0f0;
      --toolbar-bg: #fafafa;
    }

    /* Dark theme */
    [data-theme="dark"] {
      --primary: #0d0d0d;
      --secondary: #1a1a1a;
      --accent: #ff6719;
      --accent-hover: #ff8547;
      --text: #f0f0f0;
      --text-secondary: #e0e0e0;
      --text-muted: #888888;
      --bg: #0d0d0d;
      --card-bg: #1a1a1a;
      --border: #2a2a2a;
      --border-hover: #3a3a3a;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --canvas-bg: #0a0a0a;
      --toolbar-bg: #141414;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      color-scheme: light dark;
    }

    [data-theme="light"] {
      color-scheme: light;
    }

    [data-theme="dark"] {
      color-scheme: dark;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: 'Akzidenz-Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    ::selection {
      background: rgba(255, 103, 25, 0.2);
      color: inherit;
    }

    header {
      background: var(--primary);
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    header h1 {
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    header h1 a {
      color: var(--text);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    header h1 a:hover {
      color: var(--accent);
    }

    nav {
      display: flex;
      gap: 1.25rem;
      align-items: center;
      flex-wrap: wrap;
      font-size: 0.85rem;
    }

    nav a {
      color: var(--text-muted);
      text-decoration: none;
      font-weight: 500;
      transition: color 0.15s ease;
    }

    nav a:hover {
      color: var(--text);
    }

    .theme-toggle {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.4rem;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      font-size: 1rem;
    }

    .theme-toggle:hover {
      color: var(--text);
      background: var(--secondary);
    }

    .logout-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.3rem 0.7rem;
      border-radius: 16px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .logout-btn:hover {
      border-color: var(--border-hover);
      color: var(--text);
      background: var(--secondary);
    }

    #canvas-app {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .canvas-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 1rem;
      background: var(--toolbar-bg);
      border-bottom: 1px solid var(--border);
      gap: 1rem;
      flex-shrink: 0;
    }

    .toolbar-left, .toolbar-center, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .toolbar-btn {
      background: var(--primary);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .toolbar-btn:hover {
      background: var(--secondary);
      border-color: var(--border-hover);
    }

    .toolbar-btn.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }

    .toolbar-btn.primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }

    .toolbar-btn.danger {
      background: transparent;
      border-color: var(--danger);
      color: var(--danger);
    }

    .toolbar-btn.danger:hover {
      background: var(--danger);
      color: white;
    }

    .toolbar-btn.publish-btn {
      background: #059669;
      border-color: #059669;
      color: white;
    }

    .toolbar-btn.publish-btn:hover {
      background: #047857;
      border-color: #047857;
    }

    .toolbar-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .toolbar-btn:disabled:hover {
      background: var(--primary);
    }

    .toolbar-separator {
      width: 1px;
      height: 24px;
      background: var(--border);
      margin: 0 0.25rem;
    }

    .toolbar-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }

    .canvas-title-input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 500;
      width: 200px;
      transition: all 0.15s ease;
    }

    .canvas-title-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(255, 103, 25, 0.1);
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    #zoom-level {
      min-width: 50px;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .canvas-viewport {
      flex: 1;
      overflow: auto;
      background: var(--canvas-bg);
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      padding: 2rem;
    }

    .canvas-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      position: relative;
      transform-origin: top left;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      border-radius: 8px;
    }

    [data-theme="dark"] .canvas-container {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    .canvas-container.show-grid {
      background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
      background-size: 20px 20px;
      background-position: 0 0;
    }

    .canvas-block {
      position: absolute;
      background: var(--secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: move;
      user-select: none;
      overflow: hidden;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .canvas-block:hover {
      border-color: var(--accent);
    }

    .canvas-block.selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(255, 103, 25, 0.2);
    }

    .canvas-block.editing {
      cursor: text;
    }

    .canvas-block-content {
      padding: 0.75rem;
      width: 100%;
      height: 100%;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .canvas-block-content:focus {
      outline: none;
    }

    .canvas-block .resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--accent);
      border-radius: 2px;
      cursor: se-resize;
      right: -5px;
      bottom: -5px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .canvas-block:hover .resize-handle,
    .canvas-block.selected .resize-handle {
      opacity: 1;
    }

    .status-bar {
      display: flex;
      justify-content: space-between;
      padding: 0.35rem 1rem;
      background: var(--primary);
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: var(--text-muted);
      flex-shrink: 0;
      font-weight: 500;
    }

    .inline-form {
      display: inline;
    }
  </style>
</head>
<body>
  <header>
    <h1><a href="/">Leaflet</a></h1>
    <div style="display: flex; align-items: center; gap: 1rem;">
      ${nav}
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle theme">
        <span class="theme-icon">☀️</span>
      </button>
    </div>
  </header>
  ${content}
  <script>
    (function() {
      // Canvas Editor JavaScript
      const app = document.getElementById('canvas-app');
      if (!app) return;

      const canvasId = app.dataset.canvasId;
      const csrfToken = app.dataset.csrfToken;
      let canvasTitle = app.dataset.canvasTitle;
      let blocks = JSON.parse(app.dataset.canvasBlocks || '[]');
      let canvasWidth = parseInt(app.dataset.canvasWidth) || 1200;
      let canvasHeight = parseInt(app.dataset.canvasHeight) || 800;

      const container = document.getElementById('canvas-container');
      const titleInput = document.getElementById('canvas-title');
      const addBlockBtn = document.getElementById('add-block-btn');
      const saveBtn = document.getElementById('save-btn');
      const zoomInBtn = document.getElementById('zoom-in-btn');
      const zoomOutBtn = document.getElementById('zoom-out-btn');
      const zoomLevelSpan = document.getElementById('zoom-level');
      const statusMessage = document.getElementById('status-message');
      const undoBtn = document.getElementById('undo-btn');
      const redoBtn = document.getElementById('redo-btn');
      const duplicateBtn = document.getElementById('duplicate-btn');
      const snapGridBtn = document.getElementById('snap-grid-btn');

      // Zoom levels
      const zoomLevels = [25, 50, 75, 100, 125, 150, 200];
      let currentZoomIndex = 3; // Start at 100%

      // Grid configuration
      const GRID_SIZE = 20; // Grid cell size in pixels
      let snapToGridEnabled = true;

      let selectedBlock = null;
      let selectedBlockId = null;
      let isDirty = false;

      // History stacks for undo/redo
      const undoStack = [];
      const redoStack = [];
      const MAX_HISTORY = 50;

      // Save current state to undo stack
      function saveState() {
        // Deep clone the blocks array
        const state = JSON.stringify(blocks);
        undoStack.push(state);
        // Limit history size
        if (undoStack.length > MAX_HISTORY) {
          undoStack.shift();
        }
        // Clear redo stack when new action is performed
        redoStack.length = 0;
        updateHistoryButtons();
      }

      // Update undo/redo button states
      function updateHistoryButtons() {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
      }

      // Update duplicate button state
      function updateDuplicateButton() {
        duplicateBtn.disabled = !selectedBlockId;
      }

      // Undo last action
      function undo() {
        if (undoStack.length === 0) return;
        // Save current state to redo stack
        redoStack.push(JSON.stringify(blocks));
        // Restore previous state
        blocks = JSON.parse(undoStack.pop());
        selectedBlock = null;
        selectedBlockId = null;
        renderBlocks();
        markDirty();
        updateHistoryButtons();
        updateDuplicateButton();
      }

      // Redo previously undone action
      function redo() {
        if (redoStack.length === 0) return;
        // Save current state to undo stack
        undoStack.push(JSON.stringify(blocks));
        // Restore next state
        blocks = JSON.parse(redoStack.pop());
        selectedBlock = null;
        selectedBlockId = null;
        renderBlocks();
        markDirty();
        updateHistoryButtons();
        updateDuplicateButton();
      }

      // Duplicate selected block
      function duplicateBlock() {
        if (!selectedBlockId) return;
        const sourceBlock = blocks.find(function(b) { return b.id === selectedBlockId; });
        if (!sourceBlock) return;

        saveState();

        const newBlock = {
          id: generateId(),
          type: sourceBlock.type,
          content: sourceBlock.content,
          x: sourceBlock.x + 20,
          y: sourceBlock.y + 20,
          width: sourceBlock.width,
          height: sourceBlock.height
        };
        blocks.push(newBlock);
        renderBlock(newBlock);
        markDirty();

        // Select the new block
        const newEl = container.querySelector('[data-block-id=\"' + newBlock.id + '\"]');
        if (newEl) {
          selectBlock(newEl, newBlock);
        }
      }

      // Snap value to grid
      function snapToGrid(value) {
        if (!snapToGridEnabled) return Math.round(value);
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
      }

      // Generate unique ID
      function generateId() {
        return 'blk_' + Math.random().toString(36).substr(2, 9);
      }

      // Update status message
      function setStatus(msg) {
        statusMessage.textContent = msg;
      }

      // Mark as dirty (unsaved changes)
      function markDirty() {
        isDirty = true;
        setStatus('Unsaved changes');
      }

      // Apply zoom
      function applyZoom() {
        const zoom = zoomLevels[currentZoomIndex];
        container.style.transform = 'scale(' + (zoom / 100) + ')';
        zoomLevelSpan.textContent = zoom + '%';
      }

      // Render all blocks
      function renderBlocks() {
        container.innerHTML = '';
        blocks.forEach(function(block) {
          renderBlock(block);
        });
      }

      // Render a single block
      function renderBlock(block) {
        const el = document.createElement('div');
        el.className = 'canvas-block';
        el.dataset.blockId = block.id;
        el.style.left = block.x + 'px';
        el.style.top = block.y + 'px';
        el.style.width = block.width + 'px';
        el.style.height = block.height + 'px';

        const content = document.createElement('div');
        content.className = 'canvas-block-content';
        content.textContent = block.content;
        content.contentEditable = 'false';
        el.appendChild(content);

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        el.appendChild(resizeHandle);

        // Selection
        el.addEventListener('mousedown', function(e) {
          if (e.target === resizeHandle) return;
          selectBlock(el, block);
        });

        // Double-click to edit
        el.addEventListener('dblclick', function(e) {
          startEditing(el, content, block);
        });

        // Drag handling
        let isDragging = false;
        let dragStateSaved = false;
        let startX, startY, origX, origY;

        el.addEventListener('mousedown', function(e) {
          if (e.target === resizeHandle || content.contentEditable === 'true') return;
          isDragging = true;
          dragStateSaved = false;
          startX = e.clientX;
          startY = e.clientY;
          origX = block.x;
          origY = block.y;
          el.style.zIndex = '1000';
          e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
          if (!isDragging) return;
          // Save state only on first move
          if (!dragStateSaved) {
            saveState();
            dragStateSaved = true;
          }
          const zoom = zoomLevels[currentZoomIndex] / 100;
          const dx = (e.clientX - startX) / zoom;
          const dy = (e.clientY - startY) / zoom;
          block.x = Math.max(0, snapToGrid(origX + dx));
          block.y = Math.max(0, snapToGrid(origY + dy));
          el.style.left = block.x + 'px';
          el.style.top = block.y + 'px';
          markDirty();
        });

        document.addEventListener('mouseup', function() {
          if (isDragging) {
            isDragging = false;
            dragStateSaved = false;
            el.style.zIndex = '';
          }
        });

        // Resize handling
        let isResizing = false;
        let resizeStateSaved = false;
        let resizeStartX, resizeStartY, origWidth, origHeight;

        resizeHandle.addEventListener('mousedown', function(e) {
          isResizing = true;
          resizeStateSaved = false;
          resizeStartX = e.clientX;
          resizeStartY = e.clientY;
          origWidth = block.width;
          origHeight = block.height;
          e.stopPropagation();
          e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
          if (!isResizing) return;
          // Save state only on first resize
          if (!resizeStateSaved) {
            saveState();
            resizeStateSaved = true;
          }
          const zoom = zoomLevels[currentZoomIndex] / 100;
          const dx = (e.clientX - resizeStartX) / zoom;
          const dy = (e.clientY - resizeStartY) / zoom;
          block.width = Math.max(GRID_SIZE * 2, snapToGrid(origWidth + dx));
          block.height = Math.max(GRID_SIZE * 2, snapToGrid(origHeight + dy));
          el.style.width = block.width + 'px';
          el.style.height = block.height + 'px';
          markDirty();
        });

        document.addEventListener('mouseup', function() {
          if (isResizing) {
            isResizing = false;
            resizeStateSaved = false;
          }
        });

        container.appendChild(el);
      }

      // Select a block
      function selectBlock(el, block) {
        // Deselect previous
        if (selectedBlock) {
          selectedBlock.classList.remove('selected');
        }
        selectedBlock = el;
        selectedBlockId = block.id;
        el.classList.add('selected');
        updateDuplicateButton();
      }

      // Start editing a block
      function startEditing(el, content, block) {
        // Save state before editing
        saveState();
        const originalContent = block.content;

        el.classList.add('editing');
        content.contentEditable = 'true';
        content.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(content);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        function stopEditing() {
          content.contentEditable = 'false';
          el.classList.remove('editing');
          const newContent = content.textContent;
          // Only mark dirty if content actually changed
          if (newContent !== originalContent) {
            block.content = newContent;
            markDirty();
          } else {
            // Remove the saved state since nothing changed
            undoStack.pop();
            updateHistoryButtons();
          }
          content.removeEventListener('blur', stopEditing);
          content.removeEventListener('keydown', handleKey);
        }

        function handleKey(e) {
          if (e.key === 'Escape') {
            stopEditing();
          }
        }

        content.addEventListener('blur', stopEditing);
        content.addEventListener('keydown', handleKey);
      }

      // Add new block
      addBlockBtn.addEventListener('click', function() {
        saveState();

        // Find a position that doesn't overlap with existing blocks
        const baseX = snapToGrid(40 + Math.random() * 80);
        const baseY = snapToGrid(40 + Math.random() * 80);

        const newBlock = {
          id: generateId(),
          type: 'text',
          content: 'New text block',
          x: baseX,
          y: baseY,
          width: GRID_SIZE * 10, // 200px when GRID_SIZE is 20
          height: GRID_SIZE * 5  // 100px when GRID_SIZE is 20
        };
        blocks.push(newBlock);
        renderBlock(newBlock);
        markDirty();
      });

      // Save canvas
      saveBtn.addEventListener('click', function() {
        setStatus('Saving...');
        saveBtn.disabled = true;

        fetch('/api/canvases/' + canvasId, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: titleInput.value,
            blocks: blocks
          })
        })
        .then(function(res) {
          if (!res.ok) throw new Error('Save failed');
          return res.json();
        })
        .then(function(data) {
          isDirty = false;
          canvasTitle = data.title;
          if (data.synced) {
            setStatus('Saved & synced');
          } else if (data.syncError) {
            setStatus('Saved locally (sync error: ' + data.syncError + ')');
          } else {
            setStatus('Saved');
          }
        })
        .catch(function(err) {
          setStatus('Error saving: ' + err.message);
        })
        .finally(function() {
          saveBtn.disabled = false;
        });
      });

      // Zoom controls
      zoomInBtn.addEventListener('click', function() {
        if (currentZoomIndex < zoomLevels.length - 1) {
          currentZoomIndex++;
          applyZoom();
        }
      });

      zoomOutBtn.addEventListener('click', function() {
        if (currentZoomIndex > 0) {
          currentZoomIndex--;
          applyZoom();
        }
      });

      // Undo/Redo/Duplicate button handlers
      undoBtn.addEventListener('click', function() {
        undo();
      });

      redoBtn.addEventListener('click', function() {
        redo();
      });

      duplicateBtn.addEventListener('click', function() {
        duplicateBlock();
      });

      // Snap to grid toggle
      function updateSnapGridState() {
        if (snapToGridEnabled) {
          snapGridBtn.classList.add('active');
          container.classList.add('show-grid');
        } else {
          snapGridBtn.classList.remove('active');
          container.classList.remove('show-grid');
        }
      }

      snapGridBtn.addEventListener('click', function() {
        snapToGridEnabled = !snapToGridEnabled;
        updateSnapGridState();
      });

      // Title change
      titleInput.addEventListener('input', function() {
        markDirty();
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        const isEditing = document.activeElement.tagName === 'INPUT' ||
                          document.activeElement.contentEditable === 'true';

        // Undo: Ctrl+Z (not when editing text)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isEditing) {
          e.preventDefault();
          undo();
          return;
        }

        // Redo: Ctrl+Y or Ctrl+Shift+Z (not when editing text)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isEditing) {
          e.preventDefault();
          redo();
          return;
        }

        // Duplicate: Ctrl+D (not when editing text)
        if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isEditing) {
          e.preventDefault();
          duplicateBlock();
          return;
        }

        // Delete selected block with Delete/Backspace key
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock && !isEditing) {
          const blockId = selectedBlock.dataset.blockId;
          const editableContent = selectedBlock.querySelector('.canvas-block-content');
          if (editableContent && editableContent.contentEditable === 'true') return;

          saveState();
          blocks = blocks.filter(function(b) { return b.id !== blockId; });
          selectedBlock.remove();
          selectedBlock = null;
          selectedBlockId = null;
          markDirty();
          updateDuplicateButton();
        }
      });

      // Warn on unsaved changes
      window.addEventListener('beforeunload', function(e) {
        if (isDirty) {
          e.preventDefault();
          e.returnValue = '';
        }
      });

      // Initial render
      renderBlocks();
      applyZoom();
      updateSnapGridState();
      setStatus('Ready');
    })();

    // Theme toggle
    (function() {
      const toggle = document.getElementById('theme-toggle');
      const icon = toggle.querySelector('.theme-icon');

      function getTheme() {
        const stored = localStorage.getItem('theme');
        if (stored) return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        icon.textContent = theme === 'dark' ? '🌙' : '☀️';
      }

      setTheme(getTheme());

      toggle.addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
      });

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('theme')) {
          setTheme(e.matches ? 'dark' : 'light');
        }
      });
    })();
  </script>
</body>
</html>`;
}
