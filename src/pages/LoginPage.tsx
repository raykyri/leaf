import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [oauthHandle, setOauthHandle] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/profile');
    }
  }, [user, navigate]);

  const oauthEnabled = import.meta.env.VITE_PUBLIC_URL;

  const handleOAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Redirect to OAuth flow
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/oauth/authorize';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'handle';
    input.value = oauthHandle;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  };

  const handleAppPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(handle, password);
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      {oauthEnabled && (
        <>
          <Card className={styles.card}>
            <CardTitle>Sign in with Bluesky</CardTitle>
            <CardContent>
              <p className={styles.description}>
                Sign in securely using your Bluesky account. You'll be redirected to authorize this app.
              </p>
              <form onSubmit={handleOAuthSubmit} className={styles.form}>
                <Input
                  label="Handle"
                  placeholder="username.bsky.social"
                  value={oauthHandle}
                  onChange={(e) => setOauthHandle(e.target.value)}
                  required
                />
                <Button type="submit">Sign in with Bluesky</Button>
              </form>
            </CardContent>
          </Card>
          <div className={styles.divider}>
            <span>or use an app password</span>
          </div>
        </>
      )}

      <Card className={styles.card}>
        <CardTitle>{oauthEnabled ? 'Sign in with App Password' : 'Login / Sign Up'}</CardTitle>
        <CardContent>
          <p className={styles.description}>
            Use your Bluesky handle and an app password to sign in.
            {!oauthEnabled && " If you don't have an account yet, signing in will create one."}
          </p>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleAppPasswordSubmit} className={styles.form}>
            <Input
              label="Handle"
              placeholder="username.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              required
            />
            <Input
              label="App Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={
                <>
                  Create an app password at{' '}
                  <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener noreferrer">
                    bsky.app/settings/app-passwords
                  </a>
                </>
              }
              required
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}
