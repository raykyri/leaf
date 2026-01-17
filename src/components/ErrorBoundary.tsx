import { Component, type ReactNode } from 'react';
import { Layout } from './Layout';
import { Button } from './ui';
import styles from './ErrorBoundary.module.css';

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
          <div className={styles.container}>
            <h1 className={styles.title}>
              Something went wrong
            </h1>
            <p className={styles.message}>
              An unexpected error occurred. Please try again or return to the home page.
            </p>
            {this.state.error && (
              <details className={styles.details}>
                <summary className={styles.summary}>
                  Error details
                </summary>
                <pre className={styles.errorMessage}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <div className={styles.actions}>
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
