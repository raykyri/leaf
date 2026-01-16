// Base CSS - Reset and typography

export const baseStyles = `
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
  }
`;

// Canvas-specific body styles (used in canvasLayout)
export const canvasBodyStyles = `
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
`;
