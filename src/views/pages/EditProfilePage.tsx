import React from 'react';
// Edit profile page component using Radix UI
import { Layout, FormCard, FormField, FormActions, SubmitButton, CsrfInput, SuccessMessage, ErrorMessage, escapeHtml } from '../components/index.ts';
import type { User } from '../../database/index.ts';

interface EditProfilePageProps {
  user: User;
  csrfToken: string;
  message?: string;
  error?: string;
}

export function EditProfilePage({ user, csrfToken, message, error }: EditProfilePageProps): React.ReactElement {
  return (
    <Layout title="Edit Profile" user={{ handle: user.handle, csrfToken }}>
      <FormCard
        title="Edit Profile"
        description={`Update your display name for this blog. Your handle (@${escapeHtml(user.handle)}) is managed through Bluesky.`}
      >
        {message && <SuccessMessage message={message} />}
        {error && <ErrorMessage message={error} />}

        <form action="/profile/edit" method="POST">
          <CsrfInput token={csrfToken} />
          <FormField
            label="Display Name"
            name="display_name"
            maxLength={64}
            placeholder="Your display name"
            defaultValue={user.display_name || ''}
            hint="Leave empty to use your handle as your display name"
          />
          <FormActions cancelHref="/profile">
            <SubmitButton>Save Changes</SubmitButton>
          </FormActions>
        </form>
      </FormCard>
    </Layout>
  );
}
