import React from 'react';
// Profile page component using Radix UI
import { Heading, Text, Flex, Button, Link } from '@radix-ui/themes';
import { Layout, PostCard, Pagination, EmptyState, SuccessMessage, CsrfInput, escapeHtml } from '../components/index.ts';
import type { Document, User } from '../../database/index.ts';

interface ProfilePageProps {
  user: User;
  posts: Document[];
  page: number;
  hasMore: boolean;
  csrfToken: string;
  message?: string;
}

export function ProfilePage({ user, posts, page, hasMore, csrfToken, message }: ProfilePageProps): React.ReactElement {
  return (
    <Layout title="My Posts" user={{ handle: user.handle, csrfToken }}>
      <Heading size="7" mb="1" className="serif">My Posts</Heading>
      <Text as="p" size="2" color="gray" mb="4" className="sans">@{escapeHtml(user.handle)}</Text>

      <Flex gap="2" mb="5">
        <form action="/refresh" method="POST" style={{ display: 'inline' }}>
          <CsrfInput token={csrfToken} />
          <Button type="submit" variant="outline" size="2">
            Refresh from PDS
          </Button>
        </form>
        <Button asChild variant="outline" size="2">
          <a href="/profile/edit">Edit Profile</a>
        </Button>
      </Flex>

      {message && <SuccessMessage message={message} />}

      {posts.length === 0 ? (
        <EmptyState>
          You haven't created any posts yet. <Link href="/create">Create your first post!</Link>
        </EmptyState>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={`${post.author}-${post.rkey}`}
              title={post.title}
              href={`/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}
              date={post.published_at || undefined}
              description={post.description || undefined}
              externalLink={`https://leaflet.pub/p/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}
            />
          ))}
          <Pagination page={page} hasMore={hasMore} baseUrl="/profile" />
        </>
      )}
    </Layout>
  );
}
