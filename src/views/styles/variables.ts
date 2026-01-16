// CSS custom properties for theming

export const cssVariables = `
  /* Light theme (default) */
  :root {
    --bg: #ffffff;
    --bg-secondary: #fafbfc;
    --bg-tertiary: #f6f7f8;
    --bg-hover: #f0f1f2;
    --bg-canvas: #e9eaeb;
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
    --shadow-canvas: 0 4px 20px rgba(0, 0, 0, 0.08);
    --canvas-block-bg: #ffffff;
    --canvas-grid: rgba(0, 0, 0, 0.06);
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
    --bg-canvas: #0c0c0c;
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
    --shadow-canvas: 0 4px 20px rgba(0, 0, 0, 0.35);
    --canvas-block-bg: #1f1f1f;
    --canvas-grid: rgba(255, 255, 255, 0.06);
  }
`;
