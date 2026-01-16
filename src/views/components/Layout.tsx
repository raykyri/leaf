// Main layout component with Radix UI Theme
import React, { type ReactNode } from 'react';
import { Theme, Container, Flex, Box, Text, Link, Button, IconButton } from '@radix-ui/themes';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { escapeHtml } from '../../utils/html.ts';

export interface OpenGraphMeta {
  title?: string;
  description?: string;
  type?: 'website' | 'article';
  url?: string;
  author?: string;
  publishedTime?: string;
}

interface LayoutProps {
  title: string;
  children: ReactNode;
  user?: { handle: string; csrfToken?: string };
  og?: OpenGraphMeta;
}

export function Layout({ title, children, user, og }: LayoutProps): React.ReactElement {
  const ogTitle = og?.title || title;
  const ogDescription = og?.description || 'A minimalist blogging platform built on AT Protocol';
  const ogType = og?.type || 'website';

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{escapeHtml(title)} - Leaflet</title>

        {/* OpenGraph tags */}
        <meta property="og:title" content={escapeHtml(ogTitle)} />
        <meta property="og:description" content={escapeHtml(ogDescription)} />
        <meta property="og:type" content={ogType} />
        <meta property="og:site_name" content="Leaflet" />
        <meta name="description" content={escapeHtml(ogDescription)} />
        {og?.url && <meta property="og:url" content={escapeHtml(og.url)} />}
        {og?.author && <meta property="article:author" content={escapeHtml(og.author)} />}
        {og?.publishedTime && <meta property="article:published_time" content={escapeHtml(og.publishedTime)} />}

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={escapeHtml(ogTitle)} />
        <meta name="twitter:description" content={escapeHtml(ogDescription)} />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

        {/* Radix UI Themes CSS */}
        <link rel="stylesheet" href="https://unpkg.com/@radix-ui/themes@3.1.6/styles.css" />

        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --accent-color: #ff6600;
            --accent-hover: #e85d00;
            --serif-font: 'Source Serif 4', Georgia, 'Times New Roman', serif;
            --sans-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          }

          body {
            font-family: var(--serif-font);
            font-optical-sizing: auto;
          }

          /* Override Radix accent color */
          .radix-themes {
            --accent-9: var(--accent-color);
            --accent-10: var(--accent-hover);
          }

          /* Custom styles to complement Radix */
          .serif { font-family: var(--serif-font); }
          .sans { font-family: var(--sans-font); }

          .logo a {
            color: inherit;
            text-decoration: none;
            font-weight: 700;
            font-size: 1.2rem;
            letter-spacing: -0.03em;
          }

          .nav-link {
            color: var(--gray-11);
            text-decoration: none;
            font-size: 0.825rem;
            font-weight: 500;
            transition: color 0.2s ease;
          }

          .nav-link:hover {
            color: var(--gray-12);
          }

          .post-title a {
            color: inherit;
            text-decoration: none;
          }

          .post-title a:hover {
            color: var(--accent-color);
          }

          .post-content p { margin-bottom: 1.625rem; }
          .post-content h1 { font-size: 1.875rem; font-weight: 700; margin: 2.75rem 0 1rem; }
          .post-content h2 { font-size: 1.4rem; font-weight: 700; margin: 2.25rem 0 0.75rem; }
          .post-content h3 { font-size: 1.2rem; font-weight: 600; margin: 2rem 0 0.625rem; }
          .post-content blockquote {
            border-left: 3px solid var(--accent-color);
            padding: 0.125rem 0 0.125rem 1.375rem;
            margin: 2rem 0;
            color: var(--gray-11);
            font-style: italic;
          }
          .post-content pre {
            background: var(--gray-3);
            padding: 1.125rem 1.375rem;
            border-radius: 6px;
            overflow-x: auto;
            margin: 1.75rem 0;
            font-size: 0.8125rem;
          }
          .post-content code {
            font-size: 0.85em;
            background: var(--gray-3);
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
          }
          .post-content pre code { background: none; padding: 0; }
          .post-content ul, .post-content ol { margin: 1.375rem 0; padding-left: 1.5rem; }
          .post-content li { margin-bottom: 0.625rem; }
          .post-content a { color: var(--accent-9); }
          .post-content hr {
            border: none;
            height: 1px;
            background: var(--gray-6);
            margin: 3.5rem auto;
            max-width: 120px;
          }

          .external-link::after {
            content: ' ↗';
            font-size: 0.7em;
            opacity: 0.7;
          }

          /* Form styles */
          textarea {
            font-family: var(--serif-font) !important;
            min-height: 220px;
          }

          /* Theme toggle styles */
          [data-theme="dark"] .sun-icon { display: block; }
          [data-theme="dark"] .moon-icon { display: none; }
          [data-theme="light"] .sun-icon { display: none; }
          [data-theme="light"] .moon-icon { display: block; }
        ` }} />

        {/* Theme initialization script */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('theme') ||
              (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.classList.toggle('dark', theme === 'dark');
          })();
        ` }} />
      </head>
      <body>
        <Theme accentColor="orange" grayColor="slate" radius="medium" scaling="100%">
          <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box asChild style={{
              borderBottom: '1px solid var(--gray-6)',
              position: 'sticky',
              top: 0,
              zIndex: 100,
              backdropFilter: 'blur(8px)',
              background: 'var(--color-background)'
            }}>
              <header>
                <Container size="3">
                  <Flex py="3" px="4" align="center" justify="between">
                    <Box className="logo sans">
                      <a href="/">Leaflet</a>
                    </Box>
                    <Flex align="center" gap="6">
                      <Flex asChild gap="5" align="center">
                        <nav>
                          <a href="/posts" className="nav-link sans">Explore</a>
                          {user && (
                            <>
                              <a href="/profile" className="nav-link sans">My Posts</a>
                              <a href="/canvases" className="nav-link sans">Canvases</a>
                            </>
                          )}
                        </nav>
                      </Flex>
                      <Flex align="center" gap="3">
                        {user && (
                          <Button asChild size="2" variant="solid" highContrast>
                            <a href="/create">Write</a>
                          </Button>
                        )}
                        <IconButton
                          id="theme-toggle"
                          variant="ghost"
                          size="2"
                          aria-label="Toggle theme"
                          style={{ cursor: 'pointer' }}
                        >
                          <SunIcon className="sun-icon" width="18" height="18" />
                          <MoonIcon className="moon-icon" width="18" height="18" />
                        </IconButton>
                        {user ? (
                          <form action="/auth/logout" method="POST" style={{ display: 'inline' }}>
                            {user.csrfToken && (
                              <input type="hidden" name="_csrf" value={escapeHtml(user.csrfToken)} />
                            )}
                            <Button type="submit" variant="outline" size="1">
                              {escapeHtml(user.handle)}
                            </Button>
                          </form>
                        ) : (
                          <Button asChild variant="outline" size="2">
                            <a href="/">Sign in</a>
                          </Button>
                        )}
                      </Flex>
                    </Flex>
                  </Flex>
                </Container>
              </header>
            </Box>

            {/* Main content */}
            <Box asChild style={{ flex: 1 }}>
              <main>
                <Container size="2" py="6" px="4">
                  {children}
                </Container>
              </main>
            </Box>

            {/* Footer */}
            <Box asChild style={{ borderTop: '1px solid var(--gray-6)' }}>
              <footer>
                <Container size="3">
                  <Flex py="4" justify="center">
                    <Text size="1" color="gray" className="sans">
                      Built on <Link href="https://atproto.com" target="_blank">AT Protocol</Link> using the <Link href="https://leaflet.pub" target="_blank">Leaflet</Link> lexicon
                    </Text>
                  </Flex>
                </Container>
              </footer>
            </Box>
          </Box>
        </Theme>

        {/* Theme toggle script */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var toggle = document.getElementById('theme-toggle');
            if (toggle) {
              toggle.addEventListener('click', function() {
                var current = document.documentElement.getAttribute('data-theme') || 'light';
                var next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                document.documentElement.classList.toggle('dark', next === 'dark');
                localStorage.setItem('theme', next);
              });
            }
          })();
        ` }} />
      </body>
    </html>
  );
}

export { escapeHtml };
