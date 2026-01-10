// HTML layout templates

export function layout(title: string, content: string, user?: { handle: string; csrfToken?: string }): string {
  const nav = user
    ? `
      <nav>
        <a href="/posts">All Posts</a>
        <a href="/profile">My Posts</a>
        <a href="/create">New Post</a>
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
  <title>${escapeHtml(title)} - Leaflet Blog</title>
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

    .logout-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .logout-btn:hover {
      background: var(--secondary);
      color: var(--text);
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

function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}

export { escapeHtml };
