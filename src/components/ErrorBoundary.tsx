import { Component, type ReactNode } from 'react';
import { Layout } from './Layout';
import { Button } from './ui';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Layout>
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            <h1 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Something went wrong
            </h1>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              An unexpected error occurred. Please try again or return to the home page.
            </p>
            {this.state.error && (
              <details style={{
                textAlign: 'left',
                marginBottom: '1.5rem',
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>
                  Error details
                </summary>
                <pre style={{
                  marginTop: '0.5rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: 'var(--text-primary)'
                }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Button variant="primary" onClick={this.handleRetry}>
                Try again
              </Button>
              <Button variant="secondary" onClick={this.handleGoHome}>
                Go home
              </Button>
            </div>
          </div>
        </Layout>
      );
    }

    return this.props.children;
  }
}
