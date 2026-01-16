// Canvas layout component with Radix UI Theme
import React, { type ReactNode } from 'react';
import { Theme, Box, Flex, Text, Button, IconButton } from '@radix-ui/themes';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { escapeHtml } from '../../utils/html.ts';

interface CanvasLayoutProps {
  title: string;
  children: ReactNode;
  user?: { handle: string; csrfToken?: string };
}

export function CanvasLayout({ title, children, user }: CanvasLayoutProps): React.ReactElement {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{escapeHtml(title)} - Leaflet Canvas</title>

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

        {/* Radix UI Themes CSS */}
        <link rel="stylesheet" href="https://unpkg.com/@radix-ui/themes@3.1.6/styles.css" />

        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --accent-color: #ff6600;
            --canvas-grid: rgba(0, 0, 0, 0.06);
          }

          [data-theme="dark"] {
            --canvas-grid: rgba(255, 255, 255, 0.06);
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          html, body {
            height: 100%;
            overflow: hidden;
          }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            flex-direction: column;
          }

          .logo a {
            color: inherit;
            text-decoration: none;
            font-weight: 700;
            font-size: 1rem;
            letter-spacing: -0.03em;
          }

          .nav-link {
            color: var(--gray-11);
            text-decoration: none;
            font-size: 0.75rem;
            font-weight: 500;
            transition: color 0.2s ease;
          }

          .nav-link:hover {
            color: var(--gray-12);
          }

          /* Theme toggle styles */
          [data-theme="dark"] .sun-icon { display: block; }
          [data-theme="dark"] .moon-icon { display: none; }
          [data-theme="light"] .sun-icon { display: none; }
          [data-theme="light"] .moon-icon { display: block; }

          /* Canvas app styles */
          #canvas-app {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .canvas-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.5rem 1rem;
            background: var(--gray-2);
            border-bottom: 1px solid var(--gray-6);
            gap: 0.75rem;
            flex-shrink: 0;
          }

          .toolbar-left, .toolbar-center, .toolbar-right {
            display: flex;
            align-items: center;
            gap: 0.375rem;
          }

          .toolbar-btn {
            background: var(--gray-1);
            border: 1px solid var(--gray-6);
            color: var(--gray-12);
            padding: 0.375rem 0.625rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.75rem;
            font-weight: 500;
            text-decoration: none;
            white-space: nowrap;
            transition: all 0.2s ease;
          }

          .toolbar-btn:hover {
            background: var(--gray-3);
            border-color: var(--gray-7);
          }

          .toolbar-btn.primary {
            background: var(--accent-color);
            border-color: var(--accent-color);
            color: white;
          }

          .toolbar-btn.primary:hover {
            background: #e85d00;
            border-color: #e85d00;
          }

          .toolbar-btn.danger {
            background: transparent;
            border-color: var(--red-9);
            color: var(--red-9);
          }

          .toolbar-btn.danger:hover {
            background: var(--red-9);
            border-color: var(--red-9);
            color: white;
          }

          .toolbar-btn:disabled {
            opacity: 0.35;
            cursor: not-allowed;
          }

          .toolbar-btn:disabled:hover {
            background: var(--gray-1);
            border-color: var(--gray-6);
          }

          .toolbar-separator {
            width: 1px;
            height: 18px;
            background: var(--gray-6);
            margin: 0 0.25rem;
          }

          .toolbar-btn.active {
            background: var(--accent-color);
            border-color: var(--accent-color);
            color: white;
          }

          .canvas-title-input {
            background: var(--gray-1);
            border: 1px solid var(--gray-6);
            color: var(--gray-12);
            padding: 0.375rem 0.625rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 500;
            width: 180px;
            transition: all 0.2s ease;
          }

          .canvas-title-input:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.1);
          }

          .zoom-controls {
            display: flex;
            align-items: center;
            gap: 0.125rem;
          }

          #zoom-level {
            min-width: 45px;
            text-align: center;
            font-size: 0.75rem;
            color: var(--gray-11);
            font-weight: 500;
          }

          .canvas-viewport {
            flex: 1;
            overflow: auto;
            background: var(--gray-4);
            display: flex;
            align-items: flex-start;
            justify-content: flex-start;
            padding: 2rem;
          }

          .canvas-container {
            background: var(--gray-3);
            border: 1px solid var(--gray-6);
            position: relative;
            transform-origin: top left;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            border-radius: 4px;
          }

          .canvas-container.show-grid {
            background-image: radial-gradient(circle, var(--canvas-grid) 1px, transparent 1px);
            background-size: 20px 20px;
            background-position: 0 0;
          }

          .canvas-block {
            position: absolute;
            background: var(--gray-1);
            border: 1px solid var(--gray-6);
            border-radius: 6px;
            cursor: move;
            user-select: none;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
            transition: border-color 0.15s ease, box-shadow 0.15s ease;
          }

          .canvas-block:hover {
            border-color: var(--gray-8);
          }

          .canvas-block.selected {
            border-color: var(--accent-color);
            box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.1);
          }

          .canvas-block.editing {
            cursor: text;
          }

          .canvas-block-content {
            padding: 0.625rem;
            width: 100%;
            height: 100%;
            overflow: hidden;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-size: 0.875rem;
            line-height: 1.5;
          }

          .canvas-block-content:focus {
            outline: none;
          }

          .canvas-block .resize-handle {
            position: absolute;
            width: 10px;
            height: 10px;
            background: var(--accent-color);
            border-radius: 2px;
            cursor: se-resize;
            right: -5px;
            bottom: -5px;
            opacity: 0;
            transition: opacity 0.15s ease;
          }

          .canvas-block:hover .resize-handle,
          .canvas-block.selected .resize-handle {
            opacity: 1;
          }

          .status-bar {
            display: flex;
            justify-content: space-between;
            padding: 0.25rem 1rem;
            background: var(--gray-2);
            border-top: 1px solid var(--gray-6);
            font-size: 0.7rem;
            color: var(--gray-11);
            flex-shrink: 0;
            font-weight: 500;
          }

          .inline-form {
            display: inline;
          }
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
          {/* Header */}
          <Box asChild style={{ borderBottom: '1px solid var(--gray-6)' }}>
            <header>
              <Flex py="2" px="4" align="center" justify="between">
                <Box className="logo">
                  <a href="/">Leaflet</a>
                </Box>
                <Flex align="center" gap="5">
                  <Flex asChild gap="4" align="center">
                    <nav>
                      <a href="/posts" className="nav-link">Explore</a>
                      {user && (
                        <>
                          <a href="/profile" className="nav-link">My Posts</a>
                          <a href="/canvases" className="nav-link">Canvases</a>
                        </>
                      )}
                    </nav>
                  </Flex>
                  <Flex align="center" gap="2">
                    <IconButton
                      id="theme-toggle"
                      variant="ghost"
                      size="1"
                      aria-label="Toggle theme"
                      style={{ cursor: 'pointer' }}
                    >
                      <SunIcon className="sun-icon" width="16" height="16" />
                      <MoonIcon className="moon-icon" width="16" height="16" />
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
                      <Button asChild variant="outline" size="1">
                        <a href="/">Sign in</a>
                      </Button>
                    )}
                  </Flex>
                </Flex>
              </Flex>
            </header>
          </Box>

          {children}
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
