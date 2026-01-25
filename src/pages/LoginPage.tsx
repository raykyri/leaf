import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Card, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import styles from './LoginPage.module.css';

interface PdsStatus {
  status: string;
  socialProviders: {
    github: boolean;
    google: boolean;
  };
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [oauthHandle, setOauthHandle] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pdsStatus, setPdsStatus] = useState<PdsStatus | null>(null);

  // Check for error in URL params (from social login callback)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  // Fetch PDS status to know which social login providers are available
  useEffect(() => {
    fetch('/pds/status')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setPdsStatus(data);
      })
      .catch(() => {
        // PDS not enabled, ignore
      });
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/profile');
    }
  }, [user, navigate]);

  const oauthEnabled = import.meta.env.VITE_PUBLIC_URL;
  const socialLoginEnabled = pdsStatus?.socialProviders?.github || pdsStatus?.socialProviders?.google;

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
      {/* Social Login Section */}
      {socialLoginEnabled && (
        <>
          <Card className={styles.card}>
            <CardTitle>Quick Sign In</CardTitle>
            <CardContent>
              <p className={styles.description}>
                Sign in quickly with your existing account. We'll create a Leaflet identity for you.
              </p>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.socialButtons}>
                {pdsStatus?.socialProviders?.github && (
                  <a href="/pds/auth/github" className={styles.socialButton}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Continue with GitHub
                  </a>
                )}
                {pdsStatus?.socialProviders?.google && (
                  <a href="/pds/auth/google" className={styles.socialButton}>
                    <svg viewBox="0 0 24 24" width="20" height="20">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
          <div className={styles.divider}>
            <span>or sign in with Bluesky</span>
          </div>
        </>
      )}

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
