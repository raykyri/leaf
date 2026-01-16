// HTML layout templates

import { escapeHtml } from '../utils/html.ts';
import { mainStylesheet, canvasStylesheet } from './styles/index.ts';
import { navigation, canvasNavigation, type NavUser } from './components/index.ts';
import { themeInitScript, themeToggleScript } from './scripts/index.ts';
import { canvasEditorScript } from './scripts/index.ts';

export interface OpenGraphMeta {
  title?: string;
  description?: string;
  type?: 'website' | 'article';
  url?: string;
  author?: string;
  publishedTime?: string;
}

// Font preconnects and links
const fontLinks = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
`;

// Build OpenGraph meta tags
function buildOpenGraphTags(title: string, og?: OpenGraphMeta): string {
  const ogTitle = og?.title || title;
  const ogDescription = og?.description || 'A minimalist blogging platform built on AT Protocol';
  const ogType = og?.type || 'website';

  let tags = `
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="Leaflet">
  <meta name="description" content="${escapeHtml(ogDescription)}">`;

  if (og?.url) {
    tags += `\n  <meta property="og:url" content="${escapeHtml(og.url)}">`;
  }

  if (og?.author) {
    tags += `\n  <meta property="article:author" content="${escapeHtml(og.author)}">`;
  }

  if (og?.publishedTime) {
    tags += `\n  <meta property="article:published_time" content="${escapeHtml(og.publishedTime)}">`;
  }

  // Twitter Card tags
  tags += `
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">`;

  return tags;
}

export function layout(
  title: string,
  content: string,
  user?: NavUser,
  og?: OpenGraphMeta
): string {
  const ogTags = buildOpenGraphTags(title, og);
  const nav = navigation(user);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Leaflet</title>
  ${ogTags}
  ${fontLinks}
  <style>${mainStylesheet}</style>
  <script>${themeInitScript}</script>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="logo"><a href="/">Leaflet</a></div>
      ${nav}
    </div>
  </header>
  <main>
    ${content}
  </main>
  <footer>
    <p>Built on <a href="https://atproto.com" target="_blank">AT Protocol</a> using the <a href="https://leaflet.pub" target="_blank">Leaflet</a> lexicon</p>
  </footer>
  <script>${themeToggleScript}</script>
</body>
</html>`;
}

export { escapeHtml };

// Canvas-specific layout (full-width, includes canvas editor JS)
export function canvasLayout(
  title: string,
  content: string,
  user?: NavUser
): string {
  const nav = canvasNavigation(user);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Leaflet Canvas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>${canvasStylesheet}</style>
  <script>${themeInitScript}</script>
</head>
<body>
  <header>
    <div class="logo"><a href="/">Leaflet</a></div>
    ${nav}
  </header>
  ${content}
  <script>${canvasEditorScript}</script>
</body>
</html>`;
}
