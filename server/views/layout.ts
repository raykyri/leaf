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
  <script src="/js/canvas-editor.js"></script>
</body>
</html>`;
}
