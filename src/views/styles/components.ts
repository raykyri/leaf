// Component styles - Buttons, cards, forms, messages

export const buttonStyles = `
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

export const cardStyles = `
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

  @media (max-width: 768px) {
    .card {
      padding: 1.25rem 1.5rem;
      border-radius: var(--radius-sm);
    }
  }
`;

export const formStyles = `
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

  .inline-form {
    display: inline;
  }
`;

export const messageStyles = `
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
`;

export const paginationStyles = `
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
`;

export const themeToggleStyles = `
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
`;

// Export all component styles combined
export const componentStyles = `
  ${buttonStyles}
  ${cardStyles}
  ${formStyles}
  ${messageStyles}
  ${paginationStyles}
  ${themeToggleStyles}
`;
