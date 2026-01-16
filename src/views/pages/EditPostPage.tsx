import React from 'react';
// Edit post page component using Radix UI
import { Layout, FormCard, FormField, TextAreaField, FormActions, SubmitButton, CsrfInput, ErrorMessage, escapeHtml } from '../components/index.ts';
import type { Document } from '../../database/index.ts';

interface EditPostPageProps {
  post: Document;
  user: { handle: string; csrfToken?: string };
  error?: string;
}

export function EditPostPage({ post, user, error }: EditPostPageProps): React.ReactElement {
  // Extract plain text content from the document pages
  let content = '';
  try {
    const pages = JSON.parse(post.content);
    if (Array.isArray(pages)) {
      const paragraphs: string[] = [];
      for (const page of pages) {
        if (page.blocks && Array.isArray(page.blocks)) {
          for (const blockWrapper of page.blocks) {
            const block = blockWrapper.block || blockWrapper;
            if (block.plaintext) {
              paragraphs.push(block.plaintext);
            }
          }
        }
      }
      content = paragraphs.join('\n\n');
    }
  } catch {
    content = '';
  }

  return (
    <Layout title="Edit Post" user={user}>
      <FormCard title="Edit Post">
        {error && <ErrorMessage message={error} />}

        <form action={`/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}/edit`} method="POST">
          <CsrfInput token={user.csrfToken || ''} />
          <FormField
            label="Title"
            name="title"
            required
            maxLength={280}
            defaultValue={post.title}
          />
          <FormField
            label="Description (optional)"
            name="description"
            maxLength={500}
            placeholder="A brief summary of your post"
            defaultValue={post.description || ''}
          />
          <TextAreaField
            label="Content"
            name="content"
            required
            placeholder="Write your post content here...

Separate paragraphs with blank lines."
            defaultValue={content}
          />
          <FormActions cancelHref={`/posts/${encodeURIComponent(post.author)}/${encodeURIComponent(post.rkey)}`}>
            <SubmitButton>Update Post</SubmitButton>
          </FormActions>
        </form>
      </FormCard>
    </Layout>
  );
}
