// Navigation component

import { escapeHtml } from '../../utils/html.ts';
import { sunIcon, moonIcon } from './icons.ts';

export interface NavUser {
  handle: string;
  csrfToken?: string;
}

interface NavOptions {
  iconSize?: number;
  showWriteBtn?: boolean;
}

// Theme toggle button component
export function themeToggle(iconSize = 18): string {
  return `
    <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
      ${sunIcon(iconSize)}
      ${moonIcon(iconSize)}
    </button>
  `;
}

// Main navigation for authenticated users
function authenticatedNav(user: NavUser, options: NavOptions = {}): string {
  const { iconSize = 18, showWriteBtn = true } = options;

  return `
    <nav>
      <div class="nav-links">
        <a href="/posts">Explore</a>
        <a href="/profile">My Posts</a>
        <a href="/canvases">Canvases</a>
      </div>
      <div class="nav-actions">
        ${showWriteBtn ? '<a href="/create" class="write-btn">Write</a>' : ''}
        ${themeToggle(iconSize)}
        <form action="/auth/logout" method="POST" style="display: inline;">
          ${user.csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(user.csrfToken)}">` : ''}
          <button type="submit" class="logout-btn">${escapeHtml(user.handle)}</button>
        </form>
      </div>
    </nav>
  `;
}

// Navigation for unauthenticated users
function unauthenticatedNav(iconSize = 18): string {
  return `
    <nav>
      <div class="nav-links">
        <a href="/posts">Explore</a>
      </div>
      <div class="nav-actions">
        ${themeToggle(iconSize)}
        <a href="/" class="login-btn">Sign in</a>
      </div>
    </nav>
  `;
}

// Main navigation export - renders the appropriate nav based on user state
export function navigation(user?: NavUser, options: NavOptions = {}): string {
  if (user) {
    return authenticatedNav(user, options);
  }
  return unauthenticatedNav(options.iconSize);
}

// Canvas-specific navigation (smaller icons, no write button)
export function canvasNavigation(user?: NavUser): string {
  return navigation(user, { iconSize: 16, showWriteBtn: false });
}
