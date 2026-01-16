// HTML layout templates

import { escapeHtml } from '../utils/html.js';

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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Leaflet Blog</title>
  ${ogTags}
  <style>
    :root {
      --primary: #1a1a2e;
      --secondary: #16213e;
      --accent: #0f3460;
      --text: #e5e5e5;
      --text-muted: #a0a0a0;
      --bg: #0f0f1a;
      --card-bg: #1a1a2e;
      --border: #2a2a4a;
      --danger: #8a3a3a;
      --danger-hover: #a04a4a;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      min-height: 100vh;
    }

    header {
      background: var(--primary);
      padding: 1rem 2rem;
      border-bottom: 1px solid var(--border);
    }

    header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    header h1 a {
      color: var(--text);
      text-decoration: none;
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
      transition: color 0.2s;
    }

    nav a:hover {
      color: var(--text);
    }

    .logout-btn, .secondary-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .logout-btn:hover, .secondary-btn:hover {
      background: var(--secondary);
      color: var(--text);
    }

    .danger-btn {
      background: transparent;
      border: 1px solid var(--danger);
      color: #ffaaaa;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .danger-btn:hover {
      background: var(--danger);
      color: var(--text);
    }

    .primary-btn {
      background: #1d4ed8;
      border: none;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 500;
      transition: background 0.2s;
    }

    .primary-btn:hover {
      background: #2563eb;
    }

    main {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .post-title {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .post-title a {
      color: var(--text);
      text-decoration: none;
    }

    .post-title a:hover {
      text-decoration: underline;
    }

    .post-meta {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .post-meta a {
      color: var(--text-muted);
    }

    .post-excerpt {
      color: var(--text);
    }

    .post-content {
      line-height: 1.8;
    }

    .post-content p {
      margin-bottom: 1rem;
    }

    .post-content h1, .post-content h2, .post-content h3,
    .post-content h4, .post-content h5, .post-content h6 {
      margin: 1.5rem 0 0.75rem;
      line-height: 1.3;
    }

    .post-content blockquote {
      border-left: 3px solid var(--accent);
      padding-left: 1rem;
      margin: 1rem 0;
      color: var(--text-muted);
      font-style: italic;
    }

    .post-content pre {
      background: var(--secondary);
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      margin: 1rem 0;
    }

    .post-content code {
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 0.9em;
    }

    .post-content ul, .post-content ol {
      margin: 1rem 0;
      padding-left: 2rem;
    }

    .post-content li {
      margin-bottom: 0.5rem;
    }

    .post-content a {
      color: #6db3f2;
    }

    .post-content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 2rem 0;
    }

    .post-content figure {
      margin: 1.5rem 0;
    }

    .post-content .image-placeholder {
      background: var(--secondary);
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      border-radius: 4px;
    }

    .post-content figcaption {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .website-embed, .bsky-embed {
      background: var(--secondary);
      padding: 1rem;
      border-radius: 4px;
      margin: 1rem 0;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    label {
      font-weight: 500;
      margin-bottom: 0.25rem;
      display: block;
    }

    input, textarea {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--secondary);
      color: var(--text);
      font-family: inherit;
      font-size: 1rem;
    }

    input:focus, textarea:focus {
      outline: none;
      border-color: var(--accent);
    }

    textarea {
      min-height: 200px;
      resize: vertical;
    }

    button[type="submit"] {
      background: var(--accent);
      color: var(--text);
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    button[type="submit"]:hover {
      background: #1a4a80;
    }

    .error {
      background: #4a1a1a;
      border: 1px solid #8a3a3a;
      color: #ffaaaa;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
    }

    .success {
      background: #1a4a1a;
      border: 1px solid #3a8a3a;
      color: #aaffaa;
      padding: 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
    }

    .pagination {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
    }

    .pagination a {
      color: var(--text-muted);
      text-decoration: none;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: 4px;
    }

    .pagination a:hover {
      background: var(--secondary);
    }

    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-muted);
      font-size: 0.875rem;
      border-top: 1px solid var(--border);
      margin-top: 2rem;
    }

    footer a {
      color: var(--text-muted);
    }

    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 3rem;
    }

    .hint {
      color: var(--text-muted);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .post-actions {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }

    .inline-form {
      display: inline;
    }

    .external-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.875rem;
    }

    .external-link:hover {
      color: var(--text);
      text-decoration: underline;
    }

    .external-link::after {
      content: ' ↗';
    }
  </style>
</head>
<body>
  <header>
    <h1><a href="/">Leaflet Blog</a></h1>
    ${nav}
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <p>Built on <a href="https://atproto.com" target="_blank">AT Protocol</a> using the <a href="https://leaflet.pub" target="_blank">Leaflet</a> lexicon</p>
  </footer>
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
    :root {
      --primary: #1a1a2e;
      --secondary: #16213e;
      --accent: #0f3460;
      --text: #e5e5e5;
      --text-muted: #a0a0a0;
      --bg: #0f0f1a;
      --card-bg: #1a1a2e;
      --border: #2a2a4a;
      --danger: #8a3a3a;
      --danger-hover: #a04a4a;
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
      display: flex;
      flex-direction: column;
    }

    header {
      background: var(--primary);
      padding: 0.75rem 1.5rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    header h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    header h1 a {
      color: var(--text);
      text-decoration: none;
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
    }

    nav a:hover {
      color: var(--text);
    }

    .logout-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
    }

    .logout-btn:hover {
      background: var(--secondary);
      color: var(--text);
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
      background: var(--secondary);
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
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
      text-decoration: none;
      white-space: nowrap;
    }

    .toolbar-btn:hover {
      background: var(--accent);
    }

    .toolbar-btn.primary {
      background: #1d4ed8;
      border-color: #1d4ed8;
    }

    .toolbar-btn.primary:hover {
      background: #2563eb;
    }

    .toolbar-btn.danger {
      background: transparent;
      border-color: var(--danger);
      color: #ffaaaa;
    }

    .toolbar-btn.danger:hover {
      background: var(--danger);
      color: var(--text);
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
      background: #1d4ed8;
      border-color: #1d4ed8;
    }

    .canvas-title-input {
      background: var(--primary);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      font-size: 0.875rem;
      width: 200px;
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
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .canvas-viewport {
      flex: 1;
      overflow: auto;
      background: #0a0a12;
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
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    .canvas-container.show-grid {
      background-image: radial-gradient(circle, rgba(255, 255, 255, 0.15) 1px, transparent 1px);
      background-size: 20px 20px;
      background-position: 0 0;
    }

    .canvas-block {
      position: absolute;
      background: var(--secondary);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: move;
      user-select: none;
      overflow: hidden;
    }

    .canvas-block:hover {
      border-color: var(--accent);
    }

    .canvas-block.selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
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
    }

    .canvas-block-content:focus {
      outline: none;
    }

    .canvas-block .resize-handle {
      position: absolute;
      width: 10px;
      height: 10px;
      background: #3b82f6;
      border-radius: 2px;
      cursor: se-resize;
      right: -5px;
      bottom: -5px;
      opacity: 0;
    }

    .canvas-block:hover .resize-handle,
    .canvas-block.selected .resize-handle {
      opacity: 1;
    }

    .status-bar {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 1rem;
      background: var(--primary);
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
    <h1><a href="/">Leaflet Blog</a></h1>
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
  </script>
</body>
</html>`;
}
