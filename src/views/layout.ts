// HTML layout templates
// Refactored for maintainability: shared CSS, navigation, and theme components

import { escapeHtml } from '../utils/html.ts';

export interface OpenGraphMeta {
  title?: string;
  description?: string;
  type?: 'website' | 'article';
  url?: string;
  author?: string;
  publishedTime?: string;
}

// =============================================================================
// SVG Icons (shared across layouts)
// =============================================================================

const ICONS = {
  sun: (size = 18) => `<svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: (size = 18) => `<svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
};

// =============================================================================
// Shared CSS Variables (used by both layouts)
// =============================================================================

function getThemeVariables(): string {
  return `
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
  `;
}

// =============================================================================
// Utility CSS Classes (shared across layouts)
// =============================================================================

function getUtilityClasses(): string {
  return `
    /* Utility: Spacing */
    .mb-0 { margin-bottom: 0; }
    .mb-1 { margin-bottom: 0.5rem; }
    .mb-2 { margin-bottom: 1rem; }
    .mb-3 { margin-bottom: 1.5rem; }
    .mb-4 { margin-bottom: 2rem; }
    .mt-1 { margin-top: 0.5rem; }
    .mt-2 { margin-top: 1rem; }
    .ml-1 { margin-left: 0.5rem; }
    .ml-2 { margin-left: 1rem; }
    .my-3 { margin-top: 1.5rem; margin-bottom: 1.5rem; }

    /* Utility: Display & Flex */
    .flex { display: flex; }
    .inline-flex { display: inline-flex; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-1 { gap: 0.5rem; }
    .gap-2 { gap: 1rem; }
    .flex-wrap { flex-wrap: wrap; }

    /* Utility: Text */
    .text-center { text-align: center; }
    .text-muted { color: var(--text-muted); }
    .text-secondary { color: var(--text-secondary); }
    .no-decoration { text-decoration: none; }

    /* Utility: Typography */
    .heading-xl { font-size: 2rem; }

    /* Utility: Forms */
    .inline-form { display: inline; }

    /* Utility: Canvas-specific (only used in canvas editor) */
    .publish-btn {
      background: #059669;
      border-color: #059669;
    }
    .publish-btn:hover {
      background: #047857;
      border-color: #047857;
    }
  `;
}

// =============================================================================
// Base CSS Reset & Typography
// =============================================================================

function getBaseStyles(): string {
  return `
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
  `;
}

// =============================================================================
// Navigation Component
// =============================================================================

interface NavOptions {
  user?: { handle: string; csrfToken?: string };
  iconSize?: number;
  showWriteButton?: boolean;
}

function renderNavigation(options: NavOptions = {}): string {
  const { user, iconSize = 18, showWriteButton = true } = options;

  const themeToggle = `
    <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
      ${ICONS.sun(iconSize)}
      ${ICONS.moon(iconSize)}
    </button>
  `;

  if (user) {
    return `
      <nav>
        <div class="nav-links">
          <a href="/posts">Explore</a>
          <a href="/profile">My Posts</a>
          <a href="/canvases">Canvases</a>
        </div>
        <div class="nav-actions">
          ${showWriteButton ? '<a href="/create" class="write-btn">Write</a>' : ''}
          ${themeToggle}
          <form action="/auth/logout" method="POST" class="inline-form">
            ${user.csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(user.csrfToken)}">` : ''}
            <button type="submit" class="logout-btn">${escapeHtml(user.handle)}</button>
          </form>
        </div>
      </nav>
    `;
  }

  return `
    <nav>
      <div class="nav-links">
        <a href="/posts">Explore</a>
      </div>
      <div class="nav-actions">
        ${themeToggle}
        <a href="/" class="login-btn">Sign in</a>
      </div>
    </nav>
  `;
}

// =============================================================================
// Shared Component Styles
// =============================================================================

function getNavigationStyles(): string {
  return `
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
  `;
}

function getButtonStyles(): string {
  return `
    /* Buttons */
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

    .theme-toggle .sun-icon { display: none; }
    .theme-toggle .moon-icon { display: block; }
    [data-theme="dark"] .theme-toggle .sun-icon { display: block; }
    [data-theme="dark"] .theme-toggle .moon-icon { display: none; }

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
  `;
}

function getCardStyles(): string {
  return `
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
  `;
}

function getPostStyles(): string {
  return `
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

    .post-content p { margin-bottom: 1.625rem; }

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

    .post-content figure { margin: 2.5rem 0; }

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
  `;
}

function getFormStyles(): string {
  return `
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
  `;
}

function getMessageStyles(): string {
  return `
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
  `;
}

function getLayoutStyles(): string {
  return `
    /* Main content */
    main {
      max-width: 640px;
      margin: 0 auto;
      padding: 3.5rem 1.5rem 4rem;
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

    /* Empty state */
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
  `;
}

function getResponsiveStyles(): string {
  return `
    /* Responsive */
    @media (max-width: 768px) {
      html { font-size: 16px; }
      header { padding: 0.75rem 1rem; }
      nav { margin-left: 1rem; }
      .nav-links { gap: 1rem; }
      .nav-links a::after { display: none; }
      .nav-actions { gap: 0.5rem; }
      main { padding: 2rem 1rem 3rem; }
      .card {
        padding: 1.25rem 1.5rem;
        border-radius: var(--radius-sm);
      }
      .post-title { font-size: 1.25rem; }
      .post-content { font-size: 1rem; }
      .post-actions { gap: 1rem; }
    }

    @media (max-width: 480px) {
      .nav-links { display: none; }
      nav {
        justify-content: flex-end;
        margin-left: 0;
      }
      .write-btn {
        padding: 0.4rem 0.875rem;
        font-size: 0.75rem;
      }
    }
  `;
}

// =============================================================================
// Theme Toggle Script (shared)
// =============================================================================

function getThemeInitScript(): string {
  return `
    (function() {
      var theme = localStorage.getItem('theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    })();
  `;
}

function getThemeToggleScript(): string {
  return `
    (function() {
      var toggle = document.getElementById('theme-toggle');
      if (toggle) {
        toggle.addEventListener('click', function() {
          var current = document.documentElement.getAttribute('data-theme') || 'light';
          var next = current === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
        });
      }
    })();
  `;
}

// =============================================================================
// Main Layout
// =============================================================================

export function layout(
  title: string,
  content: string,
  user?: { handle: string; csrfToken?: string },
  og?: OpenGraphMeta
): string {
  const nav = renderNavigation({ user });

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
    ${getThemeVariables()}
    ${getBaseStyles()}
    ${getUtilityClasses()}
    ${getNavigationStyles()}
    ${getButtonStyles()}
    ${getCardStyles()}
    ${getPostStyles()}
    ${getFormStyles()}
    ${getMessageStyles()}
    ${getLayoutStyles()}
    ${getResponsiveStyles()}
  </style>
  <script>${getThemeInitScript()}</script>
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
  <script>${getThemeToggleScript()}</script>
</body>
</html>`;
}

export { escapeHtml };

// =============================================================================
// Canvas Layout (specialized for canvas editor)
// =============================================================================

function getCanvasSpecificVariables(): string {
  return `
    /* Canvas-specific variables (extends base theme) */
    :root {
      --bg-canvas: #e9eaeb;
      --canvas-block-bg: #ffffff;
      --canvas-grid: rgba(0, 0, 0, 0.06);
      --shadow-canvas: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    [data-theme="dark"] {
      --bg-canvas: #0c0c0c;
      --canvas-block-bg: #1f1f1f;
      --canvas-grid: rgba(255, 255, 255, 0.06);
      --shadow-canvas: 0 4px 20px rgba(0, 0, 0, 0.35);
    }
  `;
}

function getCanvasLayoutStyles(): string {
  return `
    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
    }

    header {
      padding: 0.625rem 1.25rem;
      position: relative;
      backdrop-filter: none;
      background: var(--bg);
    }

    .logo { font-size: 1rem; }

    nav { margin-left: 1.75rem; }

    .nav-links { gap: 1.25rem; }

    .nav-links a {
      font-size: 0.75rem;
    }

    .nav-links a::after { display: none; }

    .nav-actions { gap: 0.625rem; }

    .theme-toggle { padding: 0.375rem; }

    .logout-btn {
      padding: 0.25rem 0.625rem;
      border-radius: 14px;
      font-size: 0.7rem;
    }

    .login-btn {
      font-size: 0.75rem;
      padding: 0.3rem 0.75rem;
      border-radius: 14px;
    }
  `;
}

function getCanvasEditorStyles(): string {
  return `
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

    .toolbar-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }

    .toolbar-separator {
      width: 1px;
      height: 18px;
      background: var(--border);
      margin: 0 0.25rem;
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
      cursor: move;
      user-select: none;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
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

    .canvas-block-content {
      padding: 0.625rem;
      width: 100%;
      height: 100%;
      overflow: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.875rem;
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
      padding: 0.25rem 1rem;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
      font-size: 0.7rem;
      color: var(--text-muted);
      flex-shrink: 0;
      font-weight: 500;
    }
  `;
}

function getCanvasResponsiveStyles(): string {
  return `
    @media (max-width: 768px) {
      .toolbar-left, .toolbar-center, .toolbar-right {
        gap: 0.25rem;
      }
      .toolbar-btn {
        padding: 0.3rem 0.5rem;
        font-size: 0.7rem;
      }
      .canvas-title-input {
        width: 120px;
      }
      .canvas-viewport {
        padding: 1rem;
      }
    }

    @media (max-width: 480px) {
      .canvas-toolbar {
        flex-wrap: wrap;
        padding: 0.375rem 0.5rem;
      }
      .toolbar-center {
        order: 3;
        width: 100%;
        justify-content: center;
        padding-top: 0.375rem;
        border-top: 1px solid var(--border);
        margin-top: 0.375rem;
      }
    }
  `;
}

function getCanvasEditorScript(): string {
  return `
    (function() {
      // Canvas Editor JavaScript
      var app = document.getElementById('canvas-app');
      if (!app) return;

      var canvasId = app.dataset.canvasId;
      var csrfToken = app.dataset.csrfToken;
      var canvasTitle = app.dataset.canvasTitle;
      var blocks = JSON.parse(app.dataset.canvasBlocks || '[]');
      var canvasWidth = parseInt(app.dataset.canvasWidth) || 1200;
      var canvasHeight = parseInt(app.dataset.canvasHeight) || 800;

      var container = document.getElementById('canvas-container');
      var titleInput = document.getElementById('canvas-title');
      var addBlockBtn = document.getElementById('add-block-btn');
      var saveBtn = document.getElementById('save-btn');
      var zoomInBtn = document.getElementById('zoom-in-btn');
      var zoomOutBtn = document.getElementById('zoom-out-btn');
      var zoomLevelSpan = document.getElementById('zoom-level');
      var statusMessage = document.getElementById('status-message');
      var undoBtn = document.getElementById('undo-btn');
      var redoBtn = document.getElementById('redo-btn');
      var duplicateBtn = document.getElementById('duplicate-btn');
      var snapGridBtn = document.getElementById('snap-grid-btn');

      // Configuration
      var zoomLevels = [25, 50, 75, 100, 125, 150, 200];
      var currentZoomIndex = 3;
      var GRID_SIZE = 20;
      var snapToGridEnabled = true;
      var MAX_HISTORY = 50;

      // State
      var selectedBlock = null;
      var selectedBlockId = null;
      var isDirty = false;
      var undoStack = [];
      var redoStack = [];

      // Utility functions
      function generateId() {
        return 'blk_' + Math.random().toString(36).substr(2, 9);
      }

      function snapToGrid(value) {
        if (!snapToGridEnabled) return Math.round(value);
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
      }

      function setStatus(msg) {
        statusMessage.textContent = msg;
      }

      function markDirty() {
        isDirty = true;
        setStatus('Unsaved changes');
      }

      // History management
      function saveState() {
        undoStack.push(JSON.stringify(blocks));
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack.length = 0;
        updateHistoryButtons();
      }

      function updateHistoryButtons() {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
      }

      function updateDuplicateButton() {
        duplicateBtn.disabled = !selectedBlockId;
      }

      function undo() {
        if (undoStack.length === 0) return;
        redoStack.push(JSON.stringify(blocks));
        blocks = JSON.parse(undoStack.pop());
        selectedBlock = null;
        selectedBlockId = null;
        renderBlocks();
        markDirty();
        updateHistoryButtons();
        updateDuplicateButton();
      }

      function redo() {
        if (redoStack.length === 0) return;
        undoStack.push(JSON.stringify(blocks));
        blocks = JSON.parse(redoStack.pop());
        selectedBlock = null;
        selectedBlockId = null;
        renderBlocks();
        markDirty();
        updateHistoryButtons();
        updateDuplicateButton();
      }

      // Block operations
      function duplicateBlock() {
        if (!selectedBlockId) return;
        var sourceBlock = blocks.find(function(b) { return b.id === selectedBlockId; });
        if (!sourceBlock) return;

        saveState();
        var newBlock = {
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

        var newEl = container.querySelector('[data-block-id="' + newBlock.id + '"]');
        if (newEl) selectBlock(newEl, newBlock);
      }

      function selectBlock(el, block) {
        if (selectedBlock) selectedBlock.classList.remove('selected');
        selectedBlock = el;
        selectedBlockId = block.id;
        el.classList.add('selected');
        updateDuplicateButton();
      }

      function startEditing(el, content, block) {
        saveState();
        var originalContent = block.content;

        el.classList.add('editing');
        content.contentEditable = 'true';
        content.focus();

        var range = document.createRange();
        range.selectNodeContents(content);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        function stopEditing() {
          content.contentEditable = 'false';
          el.classList.remove('editing');
          var newContent = content.textContent;
          if (newContent !== originalContent) {
            block.content = newContent;
            markDirty();
          } else {
            undoStack.pop();
            updateHistoryButtons();
          }
          content.removeEventListener('blur', stopEditing);
          content.removeEventListener('keydown', handleKey);
        }

        function handleKey(e) {
          if (e.key === 'Escape') stopEditing();
        }

        content.addEventListener('blur', stopEditing);
        content.addEventListener('keydown', handleKey);
      }

      // Rendering
      function applyZoom() {
        var zoom = zoomLevels[currentZoomIndex];
        container.style.transform = 'scale(' + (zoom / 100) + ')';
        zoomLevelSpan.textContent = zoom + '%';
      }

      function renderBlocks() {
        container.innerHTML = '';
        blocks.forEach(renderBlock);
      }

      function renderBlock(block) {
        var el = document.createElement('div');
        el.className = 'canvas-block';
        el.dataset.blockId = block.id;
        el.style.left = block.x + 'px';
        el.style.top = block.y + 'px';
        el.style.width = block.width + 'px';
        el.style.height = block.height + 'px';

        var content = document.createElement('div');
        content.className = 'canvas-block-content';
        content.textContent = block.content;
        content.contentEditable = 'false';
        el.appendChild(content);

        var resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        el.appendChild(resizeHandle);

        // Selection
        el.addEventListener('mousedown', function(e) {
          if (e.target === resizeHandle) return;
          selectBlock(el, block);
        });

        // Double-click to edit
        el.addEventListener('dblclick', function() {
          startEditing(el, content, block);
        });

        // Drag handling
        var isDragging = false;
        var dragStateSaved = false;
        var startX, startY, origX, origY;

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

        function onMouseMove(e) {
          if (!isDragging) return;
          if (!dragStateSaved) {
            saveState();
            dragStateSaved = true;
          }
          var zoom = zoomLevels[currentZoomIndex] / 100;
          var dx = (e.clientX - startX) / zoom;
          var dy = (e.clientY - startY) / zoom;
          block.x = Math.max(0, snapToGrid(origX + dx));
          block.y = Math.max(0, snapToGrid(origY + dy));
          el.style.left = block.x + 'px';
          el.style.top = block.y + 'px';
          markDirty();
        }

        function onMouseUp() {
          if (isDragging) {
            isDragging = false;
            dragStateSaved = false;
            el.style.zIndex = '';
          }
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        // Resize handling
        var isResizing = false;
        var resizeStateSaved = false;
        var resizeStartX, resizeStartY, origWidth, origHeight;

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

        function onResizeMove(e) {
          if (!isResizing) return;
          if (!resizeStateSaved) {
            saveState();
            resizeStateSaved = true;
          }
          var zoom = zoomLevels[currentZoomIndex] / 100;
          var dx = (e.clientX - resizeStartX) / zoom;
          var dy = (e.clientY - resizeStartY) / zoom;
          block.width = Math.max(GRID_SIZE * 2, snapToGrid(origWidth + dx));
          block.height = Math.max(GRID_SIZE * 2, snapToGrid(origHeight + dy));
          el.style.width = block.width + 'px';
          el.style.height = block.height + 'px';
          markDirty();
        }

        function onResizeUp() {
          if (isResizing) {
            isResizing = false;
            resizeStateSaved = false;
          }
        }

        document.addEventListener('mousemove', onResizeMove);
        document.addEventListener('mouseup', onResizeUp);

        container.appendChild(el);
      }

      // Event handlers
      addBlockBtn.addEventListener('click', function() {
        saveState();
        var newBlock = {
          id: generateId(),
          type: 'text',
          content: 'New text block',
          x: snapToGrid(40 + Math.random() * 80),
          y: snapToGrid(40 + Math.random() * 80),
          width: GRID_SIZE * 10,
          height: GRID_SIZE * 5
        };
        blocks.push(newBlock);
        renderBlock(newBlock);
        markDirty();
      });

      saveBtn.addEventListener('click', function() {
        setStatus('Saving...');
        saveBtn.disabled = true;

        fetch('/api/canvases/' + canvasId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: titleInput.value, blocks: blocks })
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

      undoBtn.addEventListener('click', undo);
      redoBtn.addEventListener('click', redo);
      duplicateBtn.addEventListener('click', duplicateBlock);

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

      titleInput.addEventListener('input', markDirty);

      // Keyboard shortcuts
      document.addEventListener('keydown', function(e) {
        var isEditing = document.activeElement.tagName === 'INPUT' ||
                        document.activeElement.contentEditable === 'true';

        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !isEditing) {
          e.preventDefault();
          undo();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey)) && !isEditing) {
          e.preventDefault();
          redo();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !isEditing) {
          e.preventDefault();
          duplicateBlock();
          return;
        }

        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock && !isEditing) {
          var blockId = selectedBlock.dataset.blockId;
          var editableContent = selectedBlock.querySelector('.canvas-block-content');
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

      window.addEventListener('beforeunload', function(e) {
        if (isDirty) {
          e.preventDefault();
          e.returnValue = '';
        }
      });

      // Theme toggle
      var themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', function() {
          var current = document.documentElement.getAttribute('data-theme') || 'light';
          var next = current === 'dark' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', next);
          localStorage.setItem('theme', next);
        });
      }

      // Initialize
      renderBlocks();
      applyZoom();
      updateSnapGridState();
      setStatus('Ready');
    })();
  `;
}

export function canvasLayout(
  title: string,
  content: string,
  user?: { handle: string; csrfToken?: string }
): string {
  const nav = renderNavigation({ user, iconSize: 16, showWriteButton: false });

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
    ${getThemeVariables()}
    ${getCanvasSpecificVariables()}
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    ${getCanvasLayoutStyles()}
    ${getNavigationStyles()}
    ${getButtonStyles()}
    ${getUtilityClasses()}
    ${getCanvasEditorStyles()}
    ${getCanvasResponsiveStyles()}
  </style>
  <script>${getThemeInitScript()}</script>
</head>
<body>
  <header>
    <div class="logo"><a href="/">Leaflet</a></div>
    ${nav}
  </header>
  ${content}
  <script>${getCanvasEditorScript()}</script>
</body>
</html>`;
}
