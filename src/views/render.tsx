// React SSR rendering utility
import { renderToString } from 'react-dom/server';
import type { ReactElement } from 'react';

export function renderPage(element: ReactElement): string {
  const html = renderToString(element);
  return `<!DOCTYPE html>${html}`;
}
