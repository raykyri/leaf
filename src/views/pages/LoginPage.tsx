import React from 'react';
// Login page component using Radix UI
import { Box, Text, Link, Separator } from '@radix-ui/themes';
import { Layout, FormCard, FormField, SubmitButton, ErrorMessage, escapeHtml } from '../components/index.ts';

interface LoginPageProps {
  error?: string;
}

export function LoginPage({ error }: LoginPageProps): React.ReactElement {
  const oauthEnabled = !!process.env.PUBLIC_URL;

  return (
    <Layout title="Login">
      {oauthEnabled && (
        <>
          <FormCard
            title="Sign in with Bluesky"
            description="Sign in securely using your Bluesky account. You'll be redirected to authorize this app."
          >
            {error && <ErrorMessage message={error} />}
            <form action="/oauth/authorize" method="POST">
              <FormField
                label="Handle"
                name="handle"
                placeholder="username.bsky.social"
                required
              />
              <SubmitButton>Sign in with Bluesky</SubmitButton>
            </form>
          </FormCard>

          <Box py="4" style={{ textAlign: 'center' }}>
            <Text size="2" color="gray" className="sans">or use an app password</Text>
          </Box>
        </>
      )}

      <FormCard
        title={oauthEnabled ? 'Sign in with App Password' : 'Login / Sign Up'}
        description={`Use your Bluesky handle and an app password to sign in.${!oauthEnabled ? " If you don't have an account yet, signing in will create one." : ''}`}
      >
        {!oauthEnabled && error && <ErrorMessage message={error} />}
        <form action="/auth/login" method="POST">
          <FormField
            label="Handle"
            name="handle"
            placeholder="username.bsky.social"
            required
          />
          <FormField
            label="App Password"
            name="password"
            type="password"
            required
            hint={
              <>
                Create an app password at{' '}
                <Link href="https://bsky.app/settings/app-passwords" target="_blank">
                  bsky.app/settings/app-passwords
                </Link>
              </>
            }
          />
          <SubmitButton>Sign In</SubmitButton>
        </form>
      </FormCard>
    </Layout>
  );
}
