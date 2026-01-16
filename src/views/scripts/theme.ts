// Theme toggle scripts

// Inline script to set theme before page renders (prevents flash)
export const themeInitScript = `
  (function() {
    const theme = localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  })();
`;

// Theme toggle handler script
export const themeToggleScript = `
  (function() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', function() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
      });
    }
  })();
`;
