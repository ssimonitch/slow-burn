/**
 * Error handler interface for composable error handling
 */

import type { ErrorInfo, ReactNode } from 'react';

/**
 * Interface for error handlers that can be composed in the ErrorBoundary
 */
export interface ErrorHandler {
  /**
   * Determines if this handler can handle the given error
   */
  canHandle: (error: Error) => boolean;

  /**
   * Gets the title to display for this error
   */
  getTitle: (error: Error) => string;

  /**
   * Gets a user-friendly description of the error
   */
  getDescription: (error: Error) => string;

  /**
   * Gets the action buttons/elements to display
   * @param error The error that was caught
   * @param reset Function to reset the error boundary
   * @param navigate Optional navigation function for redirects
   */
  getActions: (error: Error, reset: () => void, navigate?: (path: string) => void) => ReactNode;

  /**
   * Optional callback when the error is caught
   * Can be used for logging, toasts, etc.
   */
  onCatch?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Priority for handler ordering (higher priority handlers are checked first)
   * Default is 0
   */
  priority?: number;

  /**
   * Optional icon to display with the error
   */
  getIcon?: () => ReactNode;
}

/**
 * Configuration for the unified ErrorBoundary
 */
export interface ErrorBoundaryConfig {
  /**
   * Custom handlers to use for error processing
   */
  handlers?: ErrorHandler[];

  /**
   * Custom fallback UI to render instead of default
   */
  fallback?: ReactNode;

  /**
   * Callback when any error is caught
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Whether to show error details in development mode
   * Default is true
   */
  showDevDetails?: boolean;

  /**
   * Custom navigation function for handlers that need to redirect
   */
  navigate?: (path: string) => void;
}
