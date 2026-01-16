// Post styles - Blog post specific styles

export const postStyles = `
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

  @media (max-width: 768px) {
    .post-title {
      font-size: 1.25rem;
    }

    .post-actions {
      gap: 1rem;
    }
  }
`;

export const postContentStyles = `
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

  @media (max-width: 768px) {
    .post-content {
      font-size: 1rem;
    }
  }
`;

// Combine all post-related styles
export const allPostStyles = `
  ${postStyles}
  ${postContentStyles}
`;
