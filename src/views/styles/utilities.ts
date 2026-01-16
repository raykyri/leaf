// Utility styles - Helper classes for common patterns

export const utilityStyles = `
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

  /* External link with arrow indicator */
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

  /* Spacing utilities */
  .mb-0 { margin-bottom: 0; }
  .mb-1 { margin-bottom: 0.5rem; }
  .mb-2 { margin-bottom: 1rem; }
  .mb-3 { margin-bottom: 1.5rem; }
  .mb-4 { margin-bottom: 2rem; }

  .mt-0 { margin-top: 0; }
  .mt-1 { margin-top: 0.5rem; }
  .mt-2 { margin-top: 1rem; }
  .mt-3 { margin-top: 1.5rem; }
  .mt-4 { margin-top: 2rem; }

  .ml-1 { margin-left: 0.5rem; }
  .ml-2 { margin-left: 1rem; }

  /* Text utilities */
  .text-muted { color: var(--text-muted); }
  .text-secondary { color: var(--text-secondary); }

  /* Display utilities */
  .flex { display: flex; }
  .inline { display: inline; }
  .inline-flex { display: inline-flex; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .gap-1 { gap: 0.5rem; }
  .gap-2 { gap: 1rem; }
  .gap-3 { gap: 1.5rem; }
  .flex-wrap { flex-wrap: wrap; }

  /* Text alignment */
  .text-center { text-align: center; }
  .text-left { text-align: left; }
  .text-right { text-align: right; }

  /* Font sizes */
  .text-sm { font-size: 0.875rem; }
  .text-base { font-size: 1rem; }
  .text-lg { font-size: 1.125rem; }
  .text-xl { font-size: 1.25rem; }
  .text-2xl { font-size: 1.5rem; }
  .text-3xl { font-size: 2rem; }

  /* Vertical margins */
  .my-0 { margin-top: 0; margin-bottom: 0; }
  .my-1 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
  .my-2 { margin-top: 1rem; margin-bottom: 1rem; }
  .my-3 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
  .my-4 { margin-top: 2rem; margin-bottom: 2rem; }

  /* Horizontal margins */
  .mx-auto { margin-left: auto; margin-right: auto; }

  /* Text decorations */
  .no-underline { text-decoration: none; }

  /* Page header pattern - common on many pages */
  .page-header {
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    margin-bottom: 0.5rem;
  }

  .page-header .subtitle {
    color: var(--text-muted);
  }

  /* Actions bar - flex container for buttons */
  .actions-bar {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  /* Divider text - "or" separator pattern */
  .divider-text {
    text-align: center;
    margin: 1.5rem 0;
    color: var(--text-muted);
  }

  /* Article header */
  .article-header {
    margin-bottom: 2rem;
  }

  .article-header h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .article-header .description {
    color: var(--text-muted);
    margin-top: 0.5rem;
  }
`;
