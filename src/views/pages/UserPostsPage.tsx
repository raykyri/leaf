import React from 'react';
// User posts page component using Radix UI
import { Heading, Text } from '@radix-ui/themes';
import { Layout, PostCard, Pagination, EmptyState, escapeHtml } from '../components/index.ts';
import type { OpenGraphMeta } from '../components/index.ts';
import type { Document, User } from '../../database/index.ts';

interface UserPostsPageProps {
  author: User;
  posts: Document[];
  page: number;
  hasMore: boolean;
  currentUser?: { handle: string; csrfToken?: string };
}

export function UserPostsPage({ author, posts, page, hasMore, currentUser }: UserPostsPageProps): React.ReactElement {
  const og: OpenGraphMeta = {
    title: `Posts by ${author.display_name || author.handle}`,
    description: `View blog posts by @${author.handle} on Leaflet Blog`,
    type: 'website'
  };

  return (
    <Layout title={`Posts by ${author.display_name || author.handle}`} user={currentUser} og={og}>
      <Heading size="7" mb="1" className="serif">{escapeHtml(author.display_name || author.handle)}</Heading>
      <Text as="p" size="2" color="gray" mb="5" className="sans">@{escapeHtml(author.handle)}</Text>

      {posts.length === 0 ? (
        <EmptyState>No posts from this user yet.</EmptyState>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={`${post.author}-${post.rkey}`}
              title={post.title}
              href={`/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}
              date={post.published_at || undefined}
              description={post.description || undefined}
            />
          ))}
          <Pagination page={page} hasMore={hasMore} baseUrl={`/user/${encodeURIComponent(author.handle)}`} />
        </>
      )}
    </Layout>
  );
}
