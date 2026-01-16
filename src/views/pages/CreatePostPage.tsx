import React from 'react';
// Create post page component using Radix UI
import { Layout, FormCard, FormField, TextAreaField, SubmitButton, CsrfInput, ErrorMessage } from '../components/index.ts';

interface CreatePostPageProps {
  user: { handle: string };
  csrfToken: string;
  error?: string;
}

export function CreatePostPage({ user, csrfToken, error }: CreatePostPageProps): React.ReactElement {
  return (
    <Layout title="Create Post" user={{ handle: user.handle, csrfToken }}>
      <FormCard title="Create New Post">
        {error && <ErrorMessage message={error} />}

        <form action="/create" method="POST">
          <CsrfInput token={csrfToken} />
          <FormField
            label="Title"
            name="title"
            required
            maxLength={280}
          />
          <FormField
            label="Description (optional)"
            name="description"
            maxLength={500}
            placeholder="A brief summary of your post"
          />
          <TextAreaField
            label="Content"
            name="content"
            required
            placeholder="Write your post content here...

Separate paragraphs with blank lines."
          />
          <SubmitButton>Publish Post</SubmitButton>
        </form>
      </FormCard>
    </Layout>
  );
}
