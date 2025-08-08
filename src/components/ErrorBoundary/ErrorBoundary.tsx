/**
 * Unified Error Boundary Component
 *
 * A composable error boundary that consolidates error handling across the application.
 * Features:
 * - Modular error handlers for different error types
 * - Consistent shadcn/ui components throughout
 * - Fitness-optimized touch targets (56px minimum)
 * - Mobile-first responsive design
 * - Development mode error details
 * - Custom fallback support
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { defaultHandlers, type ErrorBoundaryConfig, type ErrorHandler } from '@/lib/errorHandlers';
import { logError } from '@/lib/logger';

interface Props extends ErrorBoundaryConfig {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private handlers: ErrorHandler[];

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };

    // Sort handlers by priority (higher priority first)
    this.handlers = [...(props.handlers ?? defaultHandlers)].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state to trigger fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to centralized logging system
    logError('Error Boundary caught error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Find and execute handler's onCatch if available
    const handler = this.findHandler(error);
    if (handler?.onCatch) {
      handler.onCatch(error, errorInfo);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Find the first handler that can handle the error
   */
  private findHandler(error: Error): ErrorHandler | undefined {
    return this.handlers.find((handler) => handler.canHandle(error));
  }

  /**
   * Reset the error boundary state
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Find appropriate handler
      const handler = this.findHandler(this.state.error);
      if (!handler) {
        // This shouldn't happen since defaultErrorHandler handles everything
        return this.renderGenericError();
      }

      // Render error UI using the handler
      return (
        <ErrorBoundaryUI
          error={this.state.error}
          handler={handler}
          onReset={this.handleReset}
          navigate={this.props.navigate}
          showDevDetails={this.props.showDevDetails !== false}
        />
      );
    }

    return this.props.children;
  }

  /**
   * Fallback error UI if no handler is found (shouldn't happen)
   */
  private renderGenericError() {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Critical Error</CardTitle>
            <CardDescription>An unexpected error occurred and could not be handled properly.</CardDescription>
          </CardHeader>
          <CardFooter>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-[56px] w-full rounded-md px-6 py-3 text-base font-medium transition-colors"
            >
              Reload Page
            </button>
          </CardFooter>
        </Card>
      </div>
    );
  }
}

/**
 * Error UI Component
 * Renders the error UI based on the handler's configuration
 */
interface ErrorBoundaryUIProps {
  error: Error;
  handler: ErrorHandler;
  onReset: () => void;
  navigate?: (path: string) => void;
  showDevDetails: boolean;
}

function ErrorBoundaryUI({ error, handler, onReset, navigate, showDevDetails }: ErrorBoundaryUIProps) {
  const title = handler.getTitle(error);
  const description = handler.getDescription(error);
  const actions = handler.getActions(error, onReset, navigate);
  const icon = handler.getIcon?.();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <CardTitle className="text-destructive flex items-center text-xl">
            {icon}
            {title}
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">{description}</CardDescription>
        </CardHeader>

        {/* Show error details in development */}
        {showDevDetails && import.meta.env.DEV && (
          <CardContent>
            <details className="rounded-md border p-4">
              <summary className="text-muted-foreground cursor-pointer text-sm font-medium">
                Error details (development only)
              </summary>
              <pre className="mt-3 max-h-48 overflow-auto text-xs">
                {error.toString()}
                {error.stack && '\n\n' + error.stack}
              </pre>
            </details>
          </CardContent>
        )}

        <CardFooter className="flex gap-3 pt-6">{actions}</CardFooter>
      </Card>
    </div>
  );
}

/**
 * Hook-based error boundary wrapper for easier usage
 * Provides navigation support through React Router
 *
 * Example usage:
 * <ErrorBoundaryWrapper>
 *   <YourComponent />
 * </ErrorBoundaryWrapper>
 */
export function ErrorBoundaryWrapper({
  children,
  ...config
}: {
  children: ReactNode;
} & ErrorBoundaryConfig) {
  // Get navigate function from React Router if available
  let navigate: ((path: string) => void) | undefined;
  try {
    const routerNavigate = useNavigate();
    navigate = (path: string) => {
      void routerNavigate(path);
    };
  } catch {
    // Not in a Router context, that's okay
  }

  return (
    <ErrorBoundary {...config} navigate={navigate}>
      {children}
    </ErrorBoundary>
  );
}
