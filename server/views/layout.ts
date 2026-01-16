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
        <div class="nav-links">
          <a href="/posts">Explore</a>
          <a href="/profile">My Posts</a>
          <a href="/canvases">Canvases</a>
        </div>
        <div class="nav-actions">
          <a href="/create" class="write-btn">Write</a>
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
            <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>
          <form action="/auth/logout" method="POST" style="display: inline;">
            ${user.csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(user.csrfToken)}">` : ''}
            <button type="submit" class="logout-btn">${escapeHtml(user.handle)}</button>
          </form>
        </div>
      </nav>
    `
    : `
      <nav>
        <div class="nav-links">
          <a href="/posts">Explore</a>
        </div>
        <div class="nav-actions">
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
            <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>
          <a href="/" class="login-btn">Sign in</a>
        </div>
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    /* Light theme (default) */
    :root {
      --bg: #ffffff;
      --bg-secondary: #fafbfc;
      --bg-tertiary: #f6f7f8;
      --bg-hover: #f0f1f2;
      --text: #191919;
      --text-secondary: #525252;
      --text-muted: #8a8a8a;
      --border: #e8e8e8;
      --border-light: #f2f2f2;
      --border-focus: #c0c0c0;
      --accent: #ff6600;
      --accent-hover: #e85d00;
      --accent-subtle: rgba(255, 102, 0, 0.08);
      --accent-text: #ff6600;
      --link: #117799;
      --link-hover: #0d5a73;
      --danger: #d93025;
      --danger-bg: #fef1f0;
      --danger-border: #f5c6c2;
      --success: #1e8e3e;
      --success-bg: #e6f4ea;
      --success-border: #b7e1c7;
      --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-md: 0 4px 8px -2px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
      --radius-full: 9999px;
    }

    /* Dark theme */
    [data-theme="dark"] {
      --bg: #111111;
      --bg-secondary: #191919;
      --bg-tertiary: #222222;
      --bg-hover: #2a2a2a;
      --text: #f5f5f5;
      --text-secondary: #c5c5c5;
      --text-muted: #888888;
      --border: #333333;
      --border-light: #2a2a2a;
      --border-focus: #555555;
      --accent: #ff7733;
      --accent-hover: #ff8c52;
      --accent-subtle: rgba(255, 119, 51, 0.12);
      --accent-text: #ff8844;
      --link: #5cb8d6;
      --link-hover: #7fcce6;
      --danger: #f56a5e;
      --danger-bg: #2d1917;
      --danger-border: #5c2420;
      --success: #4cd964;
      --success-bg: #172d1b;
      --success-border: #245a2d;
      --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.2);
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.16);
      --shadow-md: 0 4px 8px -2px rgba(0, 0, 0, 0.32), 0 2px 4px -1px rgba(0, 0, 0, 0.16);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      font-size: 17px;
      scroll-behavior: smooth;
    }

    body {
      font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
      font-optical-sizing: auto;
      line-height: 1.75;
      color: var(--text);
      background: var(--bg);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }

    /* Header */
    header {
      background: var(--bg);
      padding: 0.875rem 2rem;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(8px);
      background: rgba(255, 255, 255, 0.95);
    }

    [data-theme="dark"] header {
      background: rgba(17, 17, 17, 0.95);
    }

    .header-inner {
      max-width: 1100px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 1.2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .logo a {
      color: var(--text);
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 1;
      margin-left: 2.5rem;
    }

    .nav-links {
      display: flex;
      gap: 1.75rem;
      align-items: center;
    }

    .nav-links a {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.825rem;
      font-weight: 500;
      letter-spacing: -0.01em;
      transition: color 0.2s ease;
      position: relative;
    }

    .nav-links a:hover {
      color: var(--text);
    }

    .nav-links a::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      width: 0;
      height: 1.5px;
      background: var(--accent);
      transition: width 0.2s ease;
    }

    .nav-links a:hover::after {
      width: 100%;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }

    .write-btn {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--accent);
      color: white;
      padding: 0.5rem 1.125rem;
      border-radius: var(--radius-full);
      text-decoration: none;
      font-size: 0.825rem;
      font-weight: 600;
      letter-spacing: -0.01em;
      transition: all 0.2s ease;
      box-shadow: var(--shadow-xs);
    }

    .write-btn:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .login-btn {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text);
      text-decoration: none;
      font-size: 0.825rem;
      font-weight: 500;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-full);
      transition: all 0.2s ease;
    }

    .login-btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-focus);
    }

    .theme-toggle {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.5rem;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .theme-toggle:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .theme-toggle .sun-icon {
      display: none;
    }

    .theme-toggle .moon-icon {
      display: block;
    }

    [data-theme="dark"] .theme-toggle .sun-icon {
      display: block;
    }

    [data-theme="dark"] .theme-toggle .moon-icon {
      display: none;
    }

    .logout-btn {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.375rem 0.75rem;
      border-radius: var(--radius-full);
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .logout-btn:hover {
      background: var(--bg-hover);
      color: var(--text);
      border-color: var(--border-focus);
    }

    .secondary-btn {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.825rem;
      font-weight: 500;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      transition: all 0.2s ease;
    }

    .secondary-btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-focus);
      color: var(--text);
    }

    .danger-btn {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: transparent;
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 0.5rem 1rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.825rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .danger-btn:hover {
      background: var(--danger);
      border-color: var(--danger);
      color: white;
    }

    .primary-btn {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--accent);
      border: none;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: var(--shadow-xs);
    }

    .primary-btn:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    /* Main content */
    main {
      max-width: 640px;
      margin: 0 auto;
      padding: 3.5rem 1.5rem 4rem;
    }

    /* Cards */
    .card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 1.75rem 2rem;
      margin-bottom: 1rem;
      transition: all 0.2s ease;
    }

    .card:hover {
      border-color: var(--border-focus);
      box-shadow: var(--shadow-sm);
    }

    /* Post styles */
    .post-title {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 1.375rem;
      font-weight: 600;
      line-height: 1.35;
      margin-bottom: 0.375rem;
      letter-spacing: -0.015em;
    }

    .post-title a {
      color: var(--text);
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .post-title a:hover {
      color: var(--accent-text);
    }

    .post-meta {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-bottom: 0.625rem;
      letter-spacing: 0.01em;
    }

    .post-meta a {
      color: var(--text-secondary);
      text-decoration: none;
      font-weight: 500;
    }

    .post-meta a:hover {
      color: var(--accent-text);
    }

    .post-excerpt {
      color: var(--text-secondary);
      font-size: 0.95rem;
      line-height: 1.65;
    }

    /* Post content (article view) */
    .post-content {
      font-size: 1.0625rem;
      line-height: 1.8;
      letter-spacing: 0.003em;
    }

    .post-content p {
      margin-bottom: 1.625rem;
    }

    .post-content h1 {
      font-size: 1.875rem;
      font-weight: 700;
      margin: 2.75rem 0 1rem;
      line-height: 1.2;
      letter-spacing: -0.025em;
    }

    .post-content h2 {
      font-size: 1.4rem;
      font-weight: 700;
      margin: 2.25rem 0 0.75rem;
      line-height: 1.3;
      letter-spacing: -0.02em;
    }

    .post-content h3 {
      font-size: 1.2rem;
      font-weight: 600;
      margin: 2rem 0 0.625rem;
      line-height: 1.35;
      letter-spacing: -0.01em;
    }

    .post-content h4, .post-content h5, .post-content h6 {
      font-size: 1.0625rem;
      font-weight: 600;
      margin: 1.75rem 0 0.5rem;
      line-height: 1.4;
    }

    .post-content blockquote {
      border-left: 3px solid var(--accent);
      padding: 0.125rem 0 0.125rem 1.375rem;
      margin: 2rem 0;
      color: var(--text-secondary);
      font-style: italic;
      font-size: 1.0625rem;
    }

    .post-content pre {
      font-family: 'SF Mono', 'Fira Code', 'Monaco', Consolas, monospace;
      background: var(--bg-tertiary);
      padding: 1.125rem 1.375rem;
      border-radius: var(--radius-sm);
      overflow-x: auto;
      margin: 1.75rem 0;
      font-size: 0.8125rem;
      line-height: 1.65;
      border: 1px solid var(--border-light);
    }

    .post-content code {
      font-family: 'SF Mono', 'Fira Code', 'Monaco', Consolas, monospace;
      font-size: 0.85em;
      background: var(--bg-tertiary);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
    }

    .post-content pre code {
      background: none;
      padding: 0;
      font-size: inherit;
    }

    .post-content ul, .post-content ol {
      margin: 1.375rem 0;
      padding-left: 1.5rem;
    }

    .post-content li {
      margin-bottom: 0.625rem;
      padding-left: 0.25rem;
    }

    .post-content a {
      color: var(--link);
      text-decoration: underline;
      text-underline-offset: 2px;
      text-decoration-color: rgba(17, 119, 153, 0.3);
      transition: all 0.15s ease;
    }

    .post-content a:hover {
      color: var(--link-hover);
      text-decoration-color: currentColor;
    }

    .post-content hr {
      border: none;
      height: 1px;
      background: var(--border);
      margin: 3.5rem auto;
      max-width: 120px;
    }

    .post-content figure {
      margin: 2.5rem 0;
    }

    .post-content img {
      max-width: 100%;
      height: auto;
      border-radius: var(--radius-sm);
    }

    .post-content .image-placeholder {
      background: var(--bg-secondary);
      padding: 3rem;
      text-align: center;
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      border: 1px dashed var(--border);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 0.875rem;
    }

    .post-content figcaption {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.8rem;
      margin-top: 0.75rem;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .website-embed, .bsky-embed {
      background: var(--bg-secondary);
      padding: 1.25rem;
      border-radius: var(--radius-sm);
      margin: 1.75rem 0;
      border: 1px solid var(--border-light);
    }

    /* Forms */
    form {
      display: flex;
      flex-direction: column;
      gap: 1.375rem;
    }

    label {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 600;
      font-size: 0.8rem;
      margin-bottom: 0.5rem;
      display: block;
      color: var(--text);
      letter-spacing: -0.01em;
    }

    input, textarea {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      width: 100%;
      padding: 0.75rem 0.875rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }

    input:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    input::placeholder, textarea::placeholder {
      color: var(--text-muted);
    }

    textarea {
      min-height: 220px;
      resize: vertical;
      line-height: 1.65;
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 1rem;
    }

    button[type="submit"] {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--accent);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      align-self: flex-start;
      box-shadow: var(--shadow-xs);
    }

    button[type="submit"]:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    /* Messages */
    .error {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger);
      padding: 0.875rem 1rem;
      border-radius: var(--radius-sm);
      margin-bottom: 1.25rem;
      font-size: 0.825rem;
      font-weight: 500;
    }

    .success {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: var(--success);
      padding: 0.875rem 1rem;
      border-radius: var(--radius-sm);
      margin-bottom: 1.25rem;
      font-size: 0.825rem;
      font-weight: 500;
    }

    /* Pagination */
    .pagination {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      gap: 0.625rem;
      justify-content: center;
      margin-top: 2.5rem;
    }

    .pagination a {
      color: var(--text-secondary);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .pagination a:hover {
      background: var(--bg-hover);
      border-color: var(--border-focus);
      color: var(--text);
    }

    /* Footer */
    footer {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      text-align: center;
      padding: 2rem 1.5rem;
      color: var(--text-muted);
      font-size: 0.75rem;
      border-top: 1px solid var(--border);
      margin-top: 2rem;
      letter-spacing: 0.01em;
    }

    footer a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    footer a:hover {
      color: var(--text-secondary);
    }

    /* Utility classes */
    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 4rem 2rem;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .empty-state h1 {
      font-family: 'Source Serif 4', Georgia, serif;
      color: var(--text);
      margin-bottom: 0.75rem;
    }

    .empty-state p {
      font-size: 0.9rem;
      line-height: 1.6;
    }

    .empty-state a {
      color: var(--accent-text);
      font-weight: 500;
    }

    .hint {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text-muted);
      font-size: 0.75rem;
      margin-top: 0.5rem;
      line-height: 1.5;
    }

    .hint a {
      color: var(--link);
    }

    .post-actions {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      gap: 1.25rem;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 0.8rem;
    }

    .post-actions a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s ease;
    }

    .post-actions a:hover {
      color: var(--text);
    }

    .inline-form {
      display: inline;
    }

    .external-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.8rem;
      transition: color 0.15s ease;
    }

    .external-link:hover {
      color: var(--text-secondary);
    }

    .external-link::after {
      content: ' \\2197';
      font-size: 0.7em;
      opacity: 0.7;
    }

    /* Page headings */
    h1 {
      font-family: 'Source Serif 4', Georgia, serif;
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }

    h2 {
      font-family: 'Source Serif 4', Georgia, serif;
      font-weight: 600;
      letter-spacing: -0.015em;
      line-height: 1.3;
    }

    /* Focus states for accessibility */
    a:focus-visible,
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    /* Selection */
    ::selection {
      background: var(--accent-subtle);
      color: var(--text);
    }

    /* Responsive */
    @media (max-width: 768px) {
      html {
        font-size: 16px;
      }

      header {
        padding: 0.75rem 1rem;
      }

      nav {
        margin-left: 1rem;
      }

      .nav-links {
        gap: 1rem;
      }

      .nav-links a::after {
        display: none;
      }

      .nav-actions {
        gap: 0.5rem;
      }

      main {
        padding: 2rem 1rem 3rem;
      }

      .card {
        padding: 1.25rem 1.5rem;
        border-radius: var(--radius-sm);
      }

      .post-title {
        font-size: 1.25rem;
      }

      .post-content {
        font-size: 1rem;
      }

      .post-actions {
        gap: 1rem;
      }
    }

    @media (max-width: 480px) {
      .nav-links {
        display: none;
      }

      nav {
        justify-content: flex-end;
        margin-left: 0;
      }

      .write-btn {
        padding: 0.4rem 0.875rem;
        font-size: 0.75rem;
      }
    }
  </style>
  <script>
    (function() {
      const theme = localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="logo"><a href="/">Leaflet</a></div>
      ${nav}
    </div>
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <p>Built on <a href="https://atproto.com" target="_blank">AT Protocol</a> using the <a href="https://leaflet.pub" target="_blank">Leaflet</a> lexicon</p>
  </footer>
  <script>
    (function() {
      const toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.addEventListener('click', function() {
          const current = document.documentElement.getAttribute('data-theme') || 'light';
          const next = current === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
        });
      }
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
        <div class="nav-links">
          <a href="/posts">Explore</a>
          <a href="/profile">My Posts</a>
          <a href="/canvases">Canvases</a>
        </div>
        <div class="nav-actions">
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
            <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>
          <form action="/auth/logout" method="POST" style="display: inline;">
            ${user.csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(user.csrfToken)}">` : ''}
            <button type="submit" class="logout-btn">${escapeHtml(user.handle)}</button>
          </form>
        </div>
      </nav>
    `
    : `
      <nav>
        <div class="nav-links">
          <a href="/posts">Explore</a>
        </div>
        <div class="nav-actions">
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
            <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>
          <a href="/" class="login-btn">Sign in</a>
        </div>
      </nav>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Leaflet Canvas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    /* Light theme (default) */
    :root {
      --bg: #ffffff;
      --bg-secondary: #fafbfc;
      --bg-tertiary: #f6f7f8;
      --bg-hover: #f0f1f2;
      --bg-canvas: #e9eaeb;
      --text: #191919;
      --text-secondary: #525252;
      --text-muted: #8a8a8a;
      --border: #e8e8e8;
      --border-light: #f2f2f2;
      --border-focus: #c0c0c0;
      --accent: #ff6600;
      --accent-hover: #e85d00;
      --accent-subtle: rgba(255, 102, 0, 0.08);
      --link: #117799;
      --danger: #d93025;
      --danger-bg: #fef1f0;
      --success: #1e8e3e;
      --canvas-block-bg: #ffffff;
      --canvas-grid: rgba(0, 0, 0, 0.06);
      --shadow-canvas: 0 4px 20px rgba(0, 0, 0, 0.08);
      --radius-sm: 6px;
    }

    /* Dark theme */
    [data-theme="dark"] {
      --bg: #111111;
      --bg-secondary: #191919;
      --bg-tertiary: #222222;
      --bg-hover: #2a2a2a;
      --bg-canvas: #0c0c0c;
      --text: #f5f5f5;
      --text-secondary: #c5c5c5;
      --text-muted: #888888;
      --border: #333333;
      --border-light: #2a2a2a;
      --border-focus: #555555;
      --accent: #ff7733;
      --accent-hover: #ff8c52;
      --accent-subtle: rgba(255, 119, 51, 0.12);
      --link: #5cb8d6;
      --danger: #f56a5e;
      --danger-bg: #2d1917;
      --success: #4cd964;
      --canvas-block-bg: #1f1f1f;
      --canvas-grid: rgba(255, 255, 255, 0.06);
      --shadow-canvas: 0 4px 20px rgba(0, 0, 0, 0.35);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: var(--text);
      background: var(--bg);
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    header {
      background: var(--bg);
      padding: 0.625rem 1.25rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .logo a {
      color: var(--text);
      text-decoration: none;
    }

    nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex: 1;
      margin-left: 1.75rem;
    }

    .nav-links {
      display: flex;
      gap: 1.25rem;
      align-items: center;
    }

    .nav-links a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.75rem;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .nav-links a:hover {
      color: var(--text);
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .theme-toggle {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.375rem;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .theme-toggle:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .theme-toggle .sun-icon {
      display: none;
    }

    .theme-toggle .moon-icon {
      display: block;
    }

    [data-theme="dark"] .theme-toggle .sun-icon {
      display: block;
    }

    [data-theme="dark"] .theme-toggle .moon-icon {
      display: none;
    }

    .logout-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.25rem 0.625rem;
      border-radius: 14px;
      cursor: pointer;
      font-size: 0.7rem;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .logout-btn:hover {
      background: var(--bg-hover);
      color: var(--text);
      border-color: var(--border-focus);
    }

    .login-btn {
      color: var(--text);
      text-decoration: none;
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.3rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 14px;
      transition: all 0.2s ease;
    }

    .login-btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-focus);
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
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      gap: 0.75rem;
      flex-shrink: 0;
    }

    .toolbar-left, .toolbar-center, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .toolbar-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.375rem 0.625rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      transition: all 0.2s ease;
    }

    .toolbar-btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-focus);
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
      border-color: var(--danger);
      color: white;
    }

    .toolbar-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .toolbar-btn:disabled:hover {
      background: var(--bg);
      border-color: var(--border);
    }

    .toolbar-separator {
      width: 1px;
      height: 18px;
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
      padding: 0.375rem 0.625rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 500;
      width: 180px;
      transition: all 0.2s ease;
    }

    .canvas-title-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-subtle);
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 0.125rem;
    }

    #zoom-level {
      min-width: 45px;
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .canvas-viewport {
      flex: 1;
      overflow: auto;
      background: var(--bg-canvas);
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
      padding: 2rem;
    }

    .canvas-container {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      position: relative;
      transform-origin: top left;
      box-shadow: var(--shadow-canvas);
      border-radius: 4px;
    }

    .canvas-container.show-grid {
      background-image: radial-gradient(circle, var(--canvas-grid) 1px, transparent 1px);
      background-size: 20px 20px;
      background-position: 0 0;
    }

    .canvas-block {
      position: absolute;
      background: var(--canvas-block-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      user-select: none;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      display: flex;
      flex-direction: column;
    }

    .canvas-block:hover {
      border-color: var(--text-muted);
    }

    .canvas-block.selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-subtle);
    }

    .canvas-block.editing {
      cursor: text;
    }

    .canvas-block.active {
      box-shadow: 8px 8px 0 var(--border);
    }

    .canvas-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 20px;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .canvas-block-drag {
      flex: 1;
      height: 100%;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas-block-drag:active {
      cursor: grabbing;
    }

    .canvas-block-drag::after {
      content: '';
      width: 20px;
      height: 4px;
      background: var(--border-focus);
      border-radius: 2px;
      opacity: 0.6;
    }

    .canvas-block-close {
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.15s ease;
      border-right: 1px solid var(--border);
    }

    .canvas-block-close:hover {
      background: var(--danger);
      color: white;
    }

    .canvas-block-content {
      padding: 0.625rem;
      width: 100%;
      flex: 1;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.875rem;
      line-height: 1.5;
      cursor: text;
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

    /* Selection box for click-and-drag creation */
    #selection-box {
      position: absolute;
      border: 2px dashed var(--accent);
      background: var(--accent-subtle);
      pointer-events: none;
      display: none;
      z-index: 9999;
    }

    #selection-box.active {
      display: block;
    }

    /* Hint text for empty canvas */
    .canvas-hint {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: var(--text-muted);
      font-size: 0.875rem;
      text-align: center;
      pointer-events: none;
      opacity: 0.7;
    }

    .canvas-hint-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .status-bar {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 1rem;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
      font-size: 0.7rem;
      color: var(--text-muted);
      flex-shrink: 0;
      font-weight: 500;
    }

    .inline-form {
      display: inline;
    }
  </style>
  <script>
    (function() {
      const theme = localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>
</head>
<body>
  <header>
    <div class="logo"><a href="/">Leaflet</a></div>
    ${nav}
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
        updateCanvasHint();

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

      // Create selection box element for drag-to-create
      const selectionBox = document.createElement('div');
      selectionBox.id = 'selection-box';
      container.appendChild(selectionBox);

      // Create canvas hint element
      const canvasHint = document.createElement('div');
      canvasHint.className = 'canvas-hint';
      canvasHint.innerHTML = '<div class="canvas-hint-icon">+</div>Click and drag to create a card';
      container.appendChild(canvasHint);

      // Update canvas hint visibility
      function updateCanvasHint() {
        canvasHint.style.display = blocks.length === 0 ? 'block' : 'none';
      }

      // Render all blocks
      function renderBlocks() {
        // Keep selection box and hint
        const children = Array.from(container.children);
        children.forEach(function(child) {
          if (child.id !== 'selection-box' && child.className !== 'canvas-hint') {
            child.remove();
          }
        });
        blocks.forEach(function(block) {
          renderBlock(block);
        });
        updateCanvasHint();
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

        // Header with close button and drag handle
        const header = document.createElement('div');
        header.className = 'canvas-block-header';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'canvas-block-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Delete block';
        header.appendChild(closeBtn);

        const dragHandle = document.createElement('div');
        dragHandle.className = 'canvas-block-drag';
        dragHandle.title = 'Drag to move';
        header.appendChild(dragHandle);

        el.appendChild(header);

        const content = document.createElement('div');
        content.className = 'canvas-block-content';
        content.textContent = block.content;
        content.contentEditable = 'false';
        el.appendChild(content);

        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        el.appendChild(resizeHandle);

        // Close button handler
        closeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          saveState();
          blocks = blocks.filter(function(b) { return b.id !== block.id; });
          el.remove();
          if (selectedBlockId === block.id) {
            selectedBlock = null;
            selectedBlockId = null;
          }
          markDirty();
          updateDuplicateButton();
          updateCanvasHint();
        });

        // Selection on header click
        header.addEventListener('mousedown', function(e) {
          if (e.target === closeBtn) return;
          selectBlock(el, block);
        });

        // Click on content to edit
        content.addEventListener('click', function(e) {
          if (content.contentEditable !== 'true') {
            selectBlock(el, block);
            startEditing(el, content, block);
          }
        });

        // Drag handling - only from drag handle
        let isDragging = false;
        let dragStateSaved = false;
        let startX, startY, origX, origY;

        dragHandle.addEventListener('mousedown', function(e) {
          isDragging = true;
          dragStateSaved = false;
          startX = e.clientX;
          startY = e.clientY;
          origX = block.x;
          origY = block.y;
          el.style.zIndex = '1000';
          el.classList.add('active');
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
            el.classList.remove('active');
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
          el.classList.add('active');
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
          block.width = Math.max(GRID_SIZE * 4, snapToGrid(origWidth + dx));
          block.height = Math.max(GRID_SIZE * 4, snapToGrid(origHeight + dy));
          el.style.width = block.width + 'px';
          el.style.height = block.height + 'px';
          markDirty();
        });

        document.addEventListener('mouseup', function() {
          if (isResizing) {
            isResizing = false;
            resizeStateSaved = false;
            el.classList.remove('active');
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

      // Add new block via button
      addBlockBtn.addEventListener('click', function() {
        saveState();

        // Find a position that doesn't overlap with existing blocks
        const baseX = snapToGrid(40 + Math.random() * 80);
        const baseY = snapToGrid(40 + Math.random() * 80);

        const newBlock = {
          id: generateId(),
          type: 'text',
          content: '',
          x: baseX,
          y: baseY,
          width: GRID_SIZE * 10, // 200px when GRID_SIZE is 20
          height: GRID_SIZE * 5  // 100px when GRID_SIZE is 20
        };
        blocks.push(newBlock);
        renderBlock(newBlock);
        markDirty();
        updateCanvasHint();
      });

      // Click-and-drag on canvas to create blocks (Manifest-style)
      const viewport = document.querySelector('.canvas-viewport');
      let isCreating = false;
      let createStartX = 0;
      let createStartY = 0;
      const MIN_SIZE = 80; // Minimum size for block creation (like Manifest)

      container.addEventListener('mousedown', function(e) {
        // Only start creation if clicking directly on container (not on blocks)
        if (e.target !== container && e.target !== canvasHint &&
            e.target.id !== 'selection-box' && !e.target.classList.contains('canvas-hint-icon')) {
          return;
        }

        isCreating = true;
        const zoom = zoomLevels[currentZoomIndex] / 100;
        const containerRect = container.getBoundingClientRect();

        // Calculate position relative to container, accounting for zoom
        createStartX = (e.clientX - containerRect.left) / zoom;
        createStartY = (e.clientY - containerRect.top) / zoom;

        // Show selection box
        selectionBox.style.left = createStartX + 'px';
        selectionBox.style.top = createStartY + 'px';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
        selectionBox.classList.add('active');

        // Deselect any selected block
        if (selectedBlock) {
          selectedBlock.classList.remove('selected');
          selectedBlock = null;
          selectedBlockId = null;
          updateDuplicateButton();
        }

        e.preventDefault();
      });

      document.addEventListener('mousemove', function(e) {
        if (!isCreating) return;

        const zoom = zoomLevels[currentZoomIndex] / 100;
        const containerRect = container.getBoundingClientRect();

        let currentX = (e.clientX - containerRect.left) / zoom;
        let currentY = (e.clientY - containerRect.top) / zoom;

        // Calculate dimensions
        let left = Math.min(createStartX, currentX);
        let top = Math.min(createStartY, currentY);
        let width = Math.abs(currentX - createStartX);
        let height = Math.abs(currentY - createStartY);

        // Snap to grid
        left = snapToGrid(left);
        top = snapToGrid(top);
        width = snapToGrid(width);
        height = snapToGrid(height);

        // Update selection box
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
      });

      document.addEventListener('mouseup', function(e) {
        if (!isCreating) return;
        isCreating = false;

        // Get final dimensions from selection box
        const left = parseInt(selectionBox.style.left) || 0;
        const top = parseInt(selectionBox.style.top) || 0;
        const width = parseInt(selectionBox.style.width) || 0;
        const height = parseInt(selectionBox.style.height) || 0;

        // Hide selection box
        selectionBox.classList.remove('active');

        // Only create block if size meets minimum threshold
        if (width >= MIN_SIZE && height >= MIN_SIZE) {
          saveState();

          const newBlock = {
            id: generateId(),
            type: 'text',
            content: '',
            x: left,
            y: top,
            width: Math.max(width, GRID_SIZE * 4),
            height: Math.max(height, GRID_SIZE * 4)
          };
          blocks.push(newBlock);
          renderBlock(newBlock);
          markDirty();
          updateCanvasHint();

          // Select and start editing the new block
          const newEl = container.querySelector('[data-block-id="' + newBlock.id + '"]');
          if (newEl) {
            selectBlock(newEl, newBlock);
            const content = newEl.querySelector('.canvas-block-content');
            if (content) {
              startEditing(newEl, content, newBlock);
            }
          }
        }
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
          updateCanvasHint();
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

      // Theme toggle
      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', function() {
          const current = document.documentElement.getAttribute('data-theme') || 'light';
          const next = current === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
        });
      }
    })();
  </script>
</body>
</html>`;
}
