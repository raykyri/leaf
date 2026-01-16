// Canvas editor styles

export const canvasLayoutStyles = `
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

  .inline-form {
    display: inline;
  }
`;

export const canvasThemeToggleStyles = `
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
`;

export const canvasToolbarStyles = `
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
`;

export const canvasViewportStyles = `
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
`;

export const canvasBlockStyles = `
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
`;

export const canvasStatusBarStyles = `
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

// Combine all canvas styles
export const allCanvasStyles = `
  ${canvasLayoutStyles}
  ${canvasThemeToggleStyles}
  ${canvasToolbarStyles}
  ${canvasViewportStyles}
  ${canvasBlockStyles}
  ${canvasStatusBarStyles}
`;
