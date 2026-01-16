import React from 'react';
// Error page components using Radix UI
import { Layout, NotFound, ErrorState } from '../components/index.ts';

interface NotFoundPageProps {
  user?: { handle: string; csrfToken?: string };
}

export function NotFoundPage({ user }: NotFoundPageProps): React.ReactElement {
  return (
    <Layout title="Not Found" user={user}>
      <NotFound />
    </Layout>
  );
}

interface ErrorPageProps {
  user?: { handle: string; csrfToken?: string };
  message?: string;
}

export function ErrorPage({ user, message }: ErrorPageProps): React.ReactElement {
  return (
    <Layout title="Error" user={user}>
      <ErrorState message={message} />
    </Layout>
  );
}
