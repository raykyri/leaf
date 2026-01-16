import React from 'react';
// Posts list page component using Radix UI
import { Heading } from '@radix-ui/themes';
import { Layout, PostCard, Pagination, EmptyState } from '../components/index.ts';
import type { Document } from '../../database/index.ts';

interface PostsListPageProps {
  posts: (Document & { handle: string; display_name: string | null })[];
  page: number;
  hasMore: boolean;
  user?: { handle: string; csrfToken?: string };
}

export function PostsListPage({ posts, page, hasMore, user }: PostsListPageProps): React.ReactElement {
  return (
    <Layout title="All Posts" user={user}>
      <Heading size="7" mb="5" className="serif">All Posts</Heading>

      {posts.length === 0 ? (
        <EmptyState>No posts yet. Be the first to create one!</EmptyState>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={`${post.author}-${post.rkey}`}
              title={post.title}
              href={`/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}
              author={{ handle: post.handle, displayName: post.display_name }}
              date={post.published_at || undefined}
              description={post.description || undefined}
            />
          ))}
          <Pagination page={page} hasMore={hasMore} baseUrl="/posts" />
        </>
      )}
    </Layout>
  );
}
