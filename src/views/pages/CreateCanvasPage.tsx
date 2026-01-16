import React from 'react';
// Create canvas page component using Radix UI
import { Layout, FormCard, FormField, SubmitButton, CsrfInput, ErrorMessage } from '../components/index.ts';

interface CreateCanvasPageProps {
  user: { handle: string; csrfToken?: string };
  error?: string;
}

export function CreateCanvasPage({ user, error }: CreateCanvasPageProps): React.ReactElement {
  return (
    <Layout title="Create Canvas" user={user}>
      <FormCard title="Create New Canvas">
        {error && <ErrorMessage message={error} />}

        <form action="/canvases/new" method="POST">
          <CsrfInput token={user.csrfToken || ''} />
          <FormField
            label="Title"
            name="title"
            required
            maxLength={128}
            placeholder="My Canvas"
          />
          <SubmitButton>Create Canvas</SubmitButton>
        </form>
      </FormCard>
    </Layout>
  );
}
