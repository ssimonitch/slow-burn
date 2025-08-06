/**
 * React Error Boundary component for catching and handling UI errors
 *
 * This component:
 * - Catches JavaScript errors in child components
 * - Logs errors to our centralized logging system
 * - Displays a fallback UI instead of crashing the app
 * - Provides a recovery mechanism for users
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { logError } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state to trigger fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to our centralized logging system
    logError('React Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
          <div className="bg-card max-w-md rounded-lg border p-6 shadow-lg">
            <div className="text-destructive mb-4 flex items-center">
              <svg className="mr-2 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-lg font-semibold">Something went wrong</h2>
            </div>

            <p className="text-muted-foreground mb-4 text-sm">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>

            {/* Show error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-4">
                <summary className="text-muted-foreground cursor-pointer text-sm font-medium">
                  Error details (development only)
                </summary>
                <pre className="bg-muted mt-2 overflow-auto rounded p-2 text-xs">
                  {this.state.error.toString()}
                  {this.state.error.stack && '\n\n' + this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                className="bg-background hover:bg-accent flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper for easier usage
 *
 * Example usage:
 * <ErrorBoundaryWrapper>
 *   <YourComponent />
 * </ErrorBoundaryWrapper>
 */
export function ErrorBoundaryWrapper({
  children,
  fallback,
  onError,
}: {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </ErrorBoundary>
  );
}
