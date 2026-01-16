import React from 'react';
// Single post page component using Radix UI
import { Box, Heading, Text, Link, Button, Flex, Separator } from '@radix-ui/themes';
import { Layout, CsrfInput, escapeHtml } from '../components/index.ts';
import type { OpenGraphMeta } from '../components/index.ts';
import { renderDocumentContent } from '../../services/renderer.ts';
import type { Document } from '../../database/index.ts';

interface PostPageProps {
  post: Document;
  author: { handle: string; display_name: string | null; did?: string };
  user?: { handle: string; csrfToken?: string };
  isOwner?: boolean;
}

export function PostPage({ post, author, user, isOwner }: PostPageProps): React.ReactElement {
  const renderedContent = renderDocumentContent(post.content);

  const og: OpenGraphMeta = {
    title: post.title,
    description: post.description || `A post by ${author.display_name || author.handle}`,
    type: 'article',
    author: author.display_name || author.handle,
    publishedTime: post.published_at || undefined
  };

  return (
    <Layout title={post.title} user={user} og={og}>
      <Box asChild mb="6">
        <article>
          <Box mb="6">
            <Heading size="8" mb="2" className="serif">{escapeHtml(post.title)}</Heading>
            <Text size="2" color="gray" className="sans">
              by <Link href={`/user/${encodeURIComponent(author.handle)}`}>{escapeHtml(author.display_name || author.handle)}</Link>
              {post.published_at && ` • ${formatDate(post.published_at)}`}
            </Text>
            {post.description && (
              <Text as="p" size="2" color="gray" mt="2">{escapeHtml(post.description)}</Text>
            )}
          </Box>

          <Box className="post-content serif" dangerouslySetInnerHTML={{ __html: renderedContent }} />
        </article>
      </Box>

      <Separator size="4" my="6" />

      <Flex gap="4" align="center" wrap="wrap" className="sans">
        <Link href="/posts" size="2" color="gray">← Back to all posts</Link>
        <Link
          href={`https://leaflet.pub/p/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}
          target="_blank"
          rel="noopener"
          size="2"
          className="external-link"
        >
          View on leaflet.pub
        </Link>

        {isOwner && user?.csrfToken && (
          <>
            <Button asChild variant="outline" size="1">
              <a href={`/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}/edit`}>
                Edit Post
              </a>
            </Button>

            <form
              action={`/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}/delete`}
              method="POST"
              style={{ display: 'inline' }}
            >
              <CsrfInput token={user.csrfToken} />
              <Button
                type="submit"
                variant="outline"
                color="red"
                size="1"
                onClick={(e: React.MouseEvent) => {
                  // Note: This onClick won't work in SSR, but the onsubmit will be added via script
                }}
              >
                Delete Post
              </Button>
            </form>
          </>
        )}
      </Flex>

      {/* Delete confirmation script */}
      <script dangerouslySetInnerHTML={{ __html: `
        document.querySelectorAll('form[action*="/delete"]').forEach(function(form) {
          form.addEventListener('submit', function(e) {
            if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) {
              e.preventDefault();
            }
          });
        });
      ` }} />
    </Layout>
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
