// Empty state component using Radix UI
import React, { type ReactNode } from 'react';
import { Box, Text, Heading, Link } from '@radix-ui/themes';

interface EmptyStateProps {
  title?: string;
  children: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps): React.ReactElement {
  return (
    <Box py="8" style={{ textAlign: 'center' }}>
      {title && (
        <Heading size="6" mb="3" className="serif">{title}</Heading>
      )}
      <Text as="p" size="2" color="gray" className="sans">
        {children}
      </Text>
    </Box>
  );
}

interface NotFoundProps {
  message?: string;
}

export function NotFound({ message = "The page you're looking for doesn't exist." }: NotFoundProps): React.ReactElement {
  return (
    <EmptyState title="404 - Not Found">
      <Text as="p" mb="2">{message}</Text>
      <Link href="/posts">Go to all posts</Link>
    </EmptyState>
  );
}

interface ErrorStateProps {
  message?: string;
}

export function ErrorState({ message = 'Something went wrong. Please try again.' }: ErrorStateProps): React.ReactElement {
  return (
    <EmptyState title="Error">
      <Text as="p" mb="2">{message}</Text>
      <Link href="/">Go home</Link>
    </EmptyState>
  );
}
