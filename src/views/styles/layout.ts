// Layout styles - Header, navigation, footer, main content

export const headerStyles = `
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

  @media (max-width: 768px) {
    header {
      padding: 0.75rem 1rem;
    }
  }
`;

export const navStyles = `
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

  @media (max-width: 768px) {
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
`;

export const mainStyles = `
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 3.5rem 1.5rem 4rem;
  }

  @media (max-width: 768px) {
    main {
      padding: 2rem 1rem 3rem;
    }
  }
`;

export const footerStyles = `
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
`;

// Export all layout styles combined
export const layoutStyles = `
  ${headerStyles}
  ${navStyles}
  ${mainStyles}
  ${footerStyles}
`;
