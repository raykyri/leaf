// Card component using Radix UI
import React, { type ReactNode } from 'react';
import { Card as RadixCard, Box, Heading, Text, Flex, Link } from '@radix-ui/themes';
import { escapeHtml } from '../../utils/html.ts';

interface PostCardProps {
  title: string;
  href: string;
  author?: { handle: string; displayName?: string | null };
  date?: string;
  description?: string;
  externalLink?: string;
}

export function PostCard({ title, href, author, date, description, externalLink }: PostCardProps): React.ReactElement {
  return (
    <RadixCard size="3" style={{ marginBottom: '1rem' }}>
      <Heading size="4" className="post-title serif" style={{ marginBottom: '0.375rem' }}>
        <a href={href}>{escapeHtml(title)}</a>
      </Heading>
      <Text as="div" size="1" color="gray" className="sans" style={{ marginBottom: '0.625rem' }}>
        {author && (
          <>
            by <Link href={`/user/${encodeURIComponent(author.handle)}`}>{escapeHtml(author.displayName || author.handle)}</Link>
          </>
        )}
        {date && (author ? ' • ' : '') + formatDate(date)}
        {externalLink && (
          <Link href={externalLink} target="_blank" rel="noopener" style={{ marginLeft: '0.5rem' }} className="external-link">
            leaflet.pub
          </Link>
        )}
      </Text>
      {description && (
        <Text as="p" size="2" color="gray">{escapeHtml(description)}</Text>
      )}
    </RadixCard>
  );
}

interface FormCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormCard({ title, description, children }: FormCardProps): React.ReactElement {
  return (
    <RadixCard size="3">
      <Heading size="5" mb="2" className="serif">{title}</Heading>
      {description && (
        <Text as="p" size="2" color="gray" mb="4">{description}</Text>
      )}
      {children}
    </RadixCard>
  );
}

interface CanvasCardProps {
  id: string;
  title: string;
  updatedAt: string;
  width: number;
  height: number;
}

export function CanvasCard({ id, title, updatedAt, width, height }: CanvasCardProps): React.ReactElement {
  return (
    <RadixCard size="3" style={{ marginBottom: '1rem' }}>
      <Heading size="4" className="post-title serif" style={{ marginBottom: '0.375rem' }}>
        <a href={`/canvases/${escapeHtml(id)}`}>{escapeHtml(title)}</a>
      </Heading>
      <Text as="div" size="1" color="gray" className="sans">
        {formatDate(updatedAt)} • {width}x{height}
      </Text>
    </RadixCard>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
