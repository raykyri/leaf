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
  <meta property="og:site_name" content="Leaflet Blog">
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
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Leaflet</title>
  ${ogTags}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    /* Light theme (default) */
    :root, [data-theme="light"] {
      --bg: #ffffff;
      --bg-secondary: #fafafa;
      --card-bg: #ffffff;
      --text: #1a1a1a;
      --text-secondary: #292929;
      --text-muted: #6b6b6b;
      --border: #e5e5e5;
      --border-light: #f0f0f0;
      --accent: #c8553d;
      --accent-hover: #b34834;
      --accent-subtle: #fdf5f3;
      --link: #c8553d;
      --link-hover: #b34834;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
      --success-bg: #f0fdf4;
      --success-border: #22c55e;
      --success-text: #166534;
      --error-bg: #fef2f2;
      --error-border: #ef4444;
      --error-text: #991b1b;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
      --shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    /* Dark theme */
    [data-theme="dark"] {
      --bg: #121212;
      --bg-secondary: #1a1a1a;
      --card-bg: #1e1e1e;
      --text: #f5f5f5;
      --text-secondary: #e0e0e0;
      --text-muted: #a0a0a0;
      --border: #2e2e2e;
      --border-light: #252525;
      --accent: #e07a5f;
      --accent-hover: #d9694b;
      --accent-subtle: #2a2220;
      --link: #e07a5f;
      --link-hover: #f09379;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success-bg: #132517;
      --success-border: #22c55e;
      --success-text: #86efac;
      --error-bg: #2d1515;
      --error-border: #ef4444;
      --error-text: #fca5a5;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
      --shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      min-height: 100vh;
      transition: background-color 0.3s ease, color 0.3s ease;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Header */
    header {
      background: var(--bg);
      padding: 1.25rem 2rem;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(8px);
      background: rgba(255, 255, 255, 0.95);
    }

    [data-theme="dark"] header {
      background: rgba(18, 18, 18, 0.95);
    }

    .header-inner {
      max-width: 680px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    header h1 {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 1.375rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    header h1 a {
      color: var(--text);
      text-decoration: none;
      transition: color 0.2s;
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
      font-size: 0.9375rem;
      font-weight: 500;
      transition: color 0.2s;
    }

    nav a:hover {
      color: var(--text);
    }

    /* Theme toggle */
    .theme-toggle {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: 8px;
      color: var(--text-muted);
      transition: background 0.2s, color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .theme-toggle:hover {
      background: var(--bg-secondary);
      color: var(--text);
    }

    .theme-toggle svg {
      width: 20px;
      height: 20px;
    }

    .theme-toggle .sun-icon { display: none; }
    .theme-toggle .moon-icon { display: block; }
    [data-theme="dark"] .theme-toggle .sun-icon { display: block; }
    [data-theme="dark"] .theme-toggle .moon-icon { display: none; }

    /* Buttons */
    .logout-btn, .secondary-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.375rem 0.875rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    .logout-btn:hover, .secondary-btn:hover {
      background: var(--bg-secondary);
      color: var(--text);
      border-color: var(--text-muted);
    }

    .danger-btn {
      background: transparent;
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 0.375rem 0.875rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .danger-btn:hover {
      background: var(--danger);
      color: white;
    }

    .primary-btn {
      background: var(--accent);
      border: none;
      color: white;
      padding: 0.625rem 1.25rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.9375rem;
      font-weight: 500;
      transition: background 0.2s, transform 0.1s;
    }

    .primary-btn:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    /* Main content */
    main {
      max-width: 680px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.75rem;
      margin-bottom: 1.25rem;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s, border-color 0.2s;
    }

    .card:hover {
      box-shadow: var(--shadow);
      border-color: var(--border);
    }

    .card h2 {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    /* Post titles */
    .post-title {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 1.375rem;
      font-weight: 700;
      line-height: 1.35;
      margin-bottom: 0.625rem;
      letter-spacing: -0.01em;
    }

    .post-title a {
      color: var(--text);
      text-decoration: none;
      transition: color 0.2s;
    }

    .post-title a:hover {
      color: var(--accent);
    }

    .post-meta {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-bottom: 0.875rem;
    }

    .post-meta a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.2s;
    }

    .post-meta a:hover {
      color: var(--text);
    }

    .post-excerpt {
      color: var(--text-secondary);
      font-size: 1rem;
      line-height: 1.65;
    }

    /* Post content - editorial typography */
    .post-content {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 1.125rem;
      line-height: 1.8;
      color: var(--text-secondary);
    }

    .post-content p {
      margin-bottom: 1.5rem;
    }

    .post-content h1, .post-content h2, .post-content h3,
    .post-content h4, .post-content h5, .post-content h6 {
      font-family: 'Libre Baskerville', Georgia, serif;
      color: var(--text);
      margin: 2.5rem 0 1rem;
      line-height: 1.3;
      letter-spacing: -0.02em;
    }

    .post-content h1 { font-size: 2rem; }
    .post-content h2 { font-size: 1.625rem; }
    .post-content h3 { font-size: 1.375rem; }

    .post-content blockquote {
      border-left: 3px solid var(--accent);
      padding: 0.5rem 0 0.5rem 1.5rem;
      margin: 2rem 0;
      color: var(--text-muted);
      font-style: italic;
      font-size: 1.125rem;
    }

    .post-content pre {
      background: var(--bg-secondary);
      padding: 1.25rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid var(--border);
    }

    .post-content code {
      font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
      font-size: 0.875em;
    }

    .post-content p code {
      background: var(--bg-secondary);
      padding: 0.2em 0.4em;
      border-radius: 4px;
    }

    .post-content ul, .post-content ol {
      margin: 1.5rem 0;
      padding-left: 1.75rem;
    }

    .post-content li {
      margin-bottom: 0.625rem;
    }

    .post-content a {
      color: var(--link);
      text-decoration: underline;
      text-decoration-color: var(--accent);
      text-underline-offset: 2px;
      transition: color 0.2s;
    }

    .post-content a:hover {
      color: var(--link-hover);
    }

    .post-content hr {
      border: none;
      text-align: center;
      margin: 3rem 0;
    }

    .post-content hr::before {
      content: '...';
      color: var(--text-muted);
      font-size: 1.5rem;
      letter-spacing: 0.5rem;
    }

    .post-content figure {
      margin: 2rem 0;
    }

    .post-content .image-placeholder {
      background: var(--bg-secondary);
      padding: 3rem;
      text-align: center;
      color: var(--text-muted);
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .post-content figcaption {
      text-align: center;
      color: var(--text-muted);
      font-family: 'Inter', sans-serif;
      font-size: 0.875rem;
      margin-top: 0.75rem;
      font-style: italic;
    }

    .website-embed, .bsky-embed {
      background: var(--bg-secondary);
      padding: 1.25rem;
      border-radius: 8px;
      margin: 1.5rem 0;
      border: 1px solid var(--border);
    }

    /* Forms */
    form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    label {
      font-weight: 500;
      margin-bottom: 0.375rem;
      display: block;
      color: var(--text);
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
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    textarea {
      min-height: 240px;
      resize: vertical;
      line-height: 1.6;
    }

    button[type="submit"] {
      background: var(--accent);
      color: white;
      border: none;
      padding: 0.875rem 1.5rem;
      border-radius: 20px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      align-self: flex-start;
    }

    button[type="submit"]:hover {
      background: var(--accent-hover);
      transform: translateY(-1px);
    }

    /* Messages */
    .error {
      background: var(--error-bg);
      border: 1px solid var(--error-border);
      color: var(--error-text);
      padding: 1rem 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.25rem;
      font-size: 0.9375rem;
    }

    .success {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: var(--success-text);
      padding: 1rem 1.25rem;
      border-radius: 8px;
      margin-bottom: 1.25rem;
      font-size: 0.9375rem;
    }

    /* Pagination */
    .pagination {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 2.5rem;
    }

    .pagination a {
      color: var(--text-muted);
      text-decoration: none;
      padding: 0.625rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: 20px;
      font-weight: 500;
      font-size: 0.9375rem;
      transition: all 0.2s;
    }

    .pagination a:hover {
      background: var(--bg-secondary);
      color: var(--text);
      border-color: var(--text-muted);
    }

    /* Footer */
    footer {
      text-align: center;
      padding: 2.5rem 1.5rem;
      color: var(--text-muted);
      font-size: 0.875rem;
      border-top: 1px solid var(--border);
      margin-top: 3rem;
    }

    footer a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.2s;
    }

    footer a:hover {
      color: var(--text);
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 4rem 2rem;
    }

    .empty-state h1 {
      font-family: 'Libre Baskerville', Georgia, serif;
      color: var(--text);
      margin-bottom: 1rem;
    }

    .empty-state p {
      margin-bottom: 0.75rem;
    }

    .empty-state a {
      color: var(--accent);
    }

    .hint {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-top: 0.375rem;
    }

    .hint a {
      color: var(--link);
    }

    /* Post actions */
    .post-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-family: 'Inter', sans-serif;
    }

    .inline-form {
      display: inline;
    }

    .external-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.2s;
    }

    .external-link:hover {
      color: var(--accent);
    }

    .external-link::after {
      content: ' ↗';
    }

    /* Page titles */
    h1 {
      font-family: 'Libre Baskerville', Georgia, serif;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    /* Article header for single posts */
    .article-header {
      text-align: center;
      margin-bottom: 2.5rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    .article-header h1 {
      font-size: 2.25rem;
      line-height: 1.25;
      margin-bottom: 1rem;
      color: var(--text);
    }

    .article-header .description {
      color: var(--text-muted);
      font-size: 1.125rem;
      line-height: 1.6;
      margin-bottom: 1.25rem;
      font-family: 'Libre Baskerville', Georgia, serif;
      font-style: italic;
    }

    .byline {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--text-muted);
      font-size: 0.9375rem;
    }

    .byline a {
      color: var(--text);
      text-decoration: none;
      font-weight: 500;
    }

    .byline a:hover {
      color: var(--accent);
    }

    .byline .separator {
      color: var(--border);
    }

    /* Section headers */
    .section-header {
      margin-bottom: 2rem;
    }

    .section-header h1 {
      font-size: 1.75rem;
      margin-bottom: 0.375rem;
    }

    .section-header p {
      color: var(--text-muted);
    }

    /* Author card on user pages */
    .author-header {
      text-align: center;
      padding: 2.5rem 0;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    .author-header h1 {
      font-size: 1.75rem;
      margin-bottom: 0.25rem;
    }

    .author-header .handle {
      color: var(--text-muted);
      font-size: 0.9375rem;
    }

    /* Refined card styling */
    .card {
      position: relative;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 12px;
      transition: box-shadow 0.2s;
      pointer-events: none;
    }

    .card:hover::before {
      box-shadow: 0 0 0 1px var(--accent-subtle);
    }

    /* Post list refinements */
    .posts-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .posts-list .card {
      border-radius: 0;
      border-left: none;
      border-right: none;
      border-top: none;
      padding: 1.5rem 0;
      margin-bottom: 0;
      box-shadow: none;
      background: transparent;
    }

    .posts-list .card:hover {
      box-shadow: none;
    }

    .posts-list .card::before {
      display: none;
    }

    .posts-list .card:first-child {
      padding-top: 0;
    }

    /* Drop cap for first paragraph in articles */
    .post-content > p:first-of-type::first-letter {
      float: left;
      font-family: 'Libre Baskerville', Georgia, serif;
      font-size: 3.5rem;
      line-height: 1;
      padding-right: 0.5rem;
      padding-top: 0.125rem;
      color: var(--text);
      font-weight: 700;
    }

    /* Better image styling in posts */
    .post-content img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }

    /* Pull quotes */
    .post-content blockquote.pullquote {
      border: none;
      text-align: center;
      padding: 1rem 2rem;
      font-size: 1.5rem;
      font-weight: 400;
      color: var(--text);
    }

    /* Focus states for accessibility */
    a:focus-visible,
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .theme-toggle:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    /* Subscribe/CTA button style */
    .cta-btn {
      background: var(--accent);
      color: white;
      padding: 0.75rem 1.75rem;
      border-radius: 24px;
      font-weight: 600;
      font-size: 0.9375rem;
      text-decoration: none;
      display: inline-block;
      transition: background 0.2s, transform 0.15s;
    }

    .cta-btn:hover {
      background: var(--accent-hover);
      transform: translateY(-2px);
    }

    /* Loading/disabled states */
    button:disabled,
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Better link styling in navigation */
    nav a.active {
      color: var(--text);
    }

    /* Refined footer */
    footer {
      background: var(--bg-secondary);
    }

    footer p {
      margin: 0;
    }

    /* Subtle animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    main {
      animation: fadeIn 0.3s ease-out;
    }

    /* Responsive refinements */
    @media (max-width: 640px) {
      header {
        padding: 1rem;
      }

      .header-inner {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      nav {
        justify-content: center;
      }

      main {
        padding: 2rem 1rem;
      }

      .article-header h1 {
        font-size: 1.75rem;
      }

      .post-content {
        font-size: 1rem;
      }

      .post-content > p:first-of-type::first-letter {
        font-size: 2.75rem;
      }

      .card {
        padding: 1.25rem;
      }
    }

    /* Print styles */
    @media print {
      header, footer, nav, .theme-toggle, .post-actions {
        display: none;
      }

      main {
        max-width: none;
        padding: 0;
      }

      .post-content {
        font-size: 12pt;
        line-height: 1.6;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <h1><a href="/">Leaflet</a></h1>
      <nav>
        ${nav}
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
          <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
      </nav>
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
      const html = document.documentElement;

      // Check for saved theme preference or system preference
      const savedTheme = localStorage.getItem('theme');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
      } else if (systemPrefersDark) {
        html.setAttribute('data-theme', 'dark');
      }

      toggle.addEventListener('click', function() {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
      });

      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('theme')) {
          html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
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
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
          <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
      </nav>
    `
    : `
      <nav>
        <a href="/posts">All Posts</a>
        <a href="/">Login</a>
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
          <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
      </nav>
    `;

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Leaflet Canvas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    /* Light theme */
    :root, [data-theme="light"] {
      --bg: #ffffff;
      --bg-secondary: #f5f5f5;
      --bg-canvas: #e8e8e8;
      --card-bg: #ffffff;
      --text: #1a1a1a;
      --text-muted: #6b6b6b;
      --border: #e0e0e0;
      --accent: #c8553d;
      --accent-hover: #b34834;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
      --toolbar-bg: #fafafa;
      --selection: #3b82f6;
    }

    /* Dark theme */
    [data-theme="dark"] {
      --bg: #121212;
      --bg-secondary: #1e1e1e;
      --bg-canvas: #0a0a0a;
      --card-bg: #252525;
      --text: #f5f5f5;
      --text-muted: #a0a0a0;
      --border: #333333;
      --accent: #e07a5f;
      --accent-hover: #d9694b;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --toolbar-bg: #1a1a1a;
      --selection: #3b82f6;
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
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      display: flex;
      flex-direction: column;
      transition: background-color 0.3s ease, color 0.3s ease;
      -webkit-font-smoothing: antialiased;
    }

    header {
      background: var(--bg);
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
    }

    header h1 a {
      color: var(--text);
      text-decoration: none;
      transition: color 0.2s;
    }

    header h1 a:hover {
      color: var(--accent);
    }

    nav {
      display: flex;
      gap: 1.25rem;
      align-items: center;
      flex-wrap: wrap;
      font-size: 0.875rem;
    }

    nav a {
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.2s;
      font-weight: 500;
    }

    nav a:hover {
      color: var(--text);
    }

    .secondary-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.3rem 0.75rem;
      border-radius: 16px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.2s;
      text-decoration: none;
    }

    .secondary-btn:hover {
      background: var(--bg-secondary);
      color: var(--text);
      border-color: var(--text-muted);
    }

    .logout-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.3rem 0.75rem;
      border-radius: 16px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.2s;
    }

    .logout-btn:hover {
      background: var(--bg-secondary);
      color: var(--text);
    }

    /* Theme toggle */
    .theme-toggle {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.4rem;
      border-radius: 6px;
      color: var(--text-muted);
      transition: background 0.2s, color 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .theme-toggle:hover {
      background: var(--bg-secondary);
      color: var(--text);
    }

    .theme-toggle svg {
      width: 18px;
      height: 18px;
    }

    .theme-toggle .sun-icon { display: none; }
    .theme-toggle .moon-icon { display: block; }
    [data-theme="dark"] .theme-toggle .sun-icon { display: block; }
    [data-theme="dark"] .theme-toggle .moon-icon { display: none; }

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
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      transition: all 0.2s;
    }

    .toolbar-btn:hover {
      background: var(--bg-secondary);
      border-color: var(--text-muted);
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

    .toolbar-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .toolbar-btn:disabled:hover {
      background: var(--bg);
      border-color: var(--border);
    }

    .toolbar-separator {
      width: 1px;
      height: 24px;
      background: var(--border);
      margin: 0 0.25rem;
    }

    .toolbar-btn.active {
      background: var(--selection);
      border-color: var(--selection);
      color: white;
    }

    .canvas-title-input {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.8125rem;
      width: 200px;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    .canvas-title-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    #zoom-level {
      min-width: 50px;
      text-align: center;
      font-size: 0.8125rem;
      color: var(--text-muted);
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
      background: var(--card-bg);
      border: 1px solid var(--border);
      position: relative;
      transform-origin: top left;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    [data-theme="dark"] .canvas-container {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }

    .canvas-container.show-grid {
      background-image: radial-gradient(circle, var(--border) 1px, transparent 1px);
      background-size: 20px 20px;
      background-position: 0 0;
    }

    .canvas-block {
      position: absolute;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: move;
      user-select: none;
      overflow: hidden;
      transition: border-color 0.15s;
    }

    .canvas-block:hover {
      border-color: var(--accent);
    }

    .canvas-block.selected {
      border-color: var(--selection);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25);
    }

    .canvas-block.editing {
      cursor: text;
    }

    .canvas-block-content {
      padding: 0.5rem;
      width: 100%;
      height: 100%;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.875rem;
    }

    .canvas-block-content:focus {
      outline: none;
    }

    .canvas-block .resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--selection);
      border-radius: 2px;
      cursor: se-resize;
      right: -5px;
      bottom: -5px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .canvas-block:hover .resize-handle,
    .canvas-block.selected .resize-handle {
      opacity: 1;
    }

    .status-bar {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 1rem;
      background: var(--toolbar-bg);
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .inline-form {
      display: inline;
    }
  </style>
</head>
<body>
  <header>
    <h1><a href="/">Leaflet</a></h1>
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
      const html = document.documentElement;

      const savedTheme = localStorage.getItem('theme');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
      } else if (systemPrefersDark) {
        html.setAttribute('data-theme', 'dark');
      }

      toggle.addEventListener('click', function() {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
      });

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (!localStorage.getItem('theme')) {
          html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    })();
  </script>
</body>
</html>`;
}
