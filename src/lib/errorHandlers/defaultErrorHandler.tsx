/**
 * Default error handler
 *
 * Fallback handler for generic errors not caught by specific handlers
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { getErrorMessage, isApiError, isStorageError, isValidationError } from '@/lib/errors';

import type { ErrorHandler } from './types';

export const defaultErrorHandler: ErrorHandler = {
  priority: 0, // Lowest priority, checked last

  canHandle: (): boolean => {
    // This handler can handle any error as a fallback
    return true;
  },

  getTitle: (error: Error): string => {
    // Provide specific titles for known error types
    if (isValidationError(error)) {
      return 'Validation Error';
    }
    if (isStorageError(error)) {
      return 'Storage Error';
    }
    if (isApiError(error)) {
      if (error.isServerError()) {
        return 'Server Error';
      }
      if (error.status === 429) {
        return 'Rate Limited';
      }
      if (error.status === 404) {
        return 'Not Found';
      }
    }

    // Check for common error patterns
    const message = error.message.toLowerCase();
    if (message.includes('permission')) {
      return 'Permission Denied';
    }
    if (message.includes('not found')) {
      return 'Not Found';
    }
    if (message.includes('timeout')) {
      return 'Request Timeout';
    }

    return 'Something Went Wrong';
  },

  getDescription: (error: Error): string => {
    // Use the error's getUserMessage if available
    if (isApiError(error)) {
      return error.getUserMessage();
    }

    // Provide specific descriptions for known error types
    if (isValidationError(error)) {
      if (error.field) {
        return `There was a problem with the ${error.field} field. Please check your input and try again.`;
      }
      return 'The information provided is not valid. Please check your input and try again.';
    }

    if (isStorageError(error)) {
      return 'There was a problem saving or retrieving data. Please try again or clear your browser data if the problem persists.';
    }

    // Extract user-friendly message
    const userMessage = getErrorMessage(error);
    if (userMessage && userMessage !== 'An unexpected error occurred') {
      return userMessage;
    }

    return 'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.';
  },

  getActions: (error: Error, reset: () => void, navigate?: (path: string) => void): ReactNode => {
    const handleReset = () => {
      reset();
    };

    const handleGoHome = () => {
      if (navigate) {
        navigate('/');
      } else {
        window.location.href = '/';
      }
    };

    const handleRefresh = () => {
      window.location.reload();
    };

    // For storage errors, offer to clear data
    if (isStorageError(error)) {
      return (
        <>
          <Button onClick={handleRefresh} className="min-h-[56px] flex-1 text-base" variant="default" size="lg">
            Refresh Page
          </Button>
          <Button onClick={handleGoHome} className="min-h-[56px] flex-1 text-base" variant="outline" size="lg">
            Go Home
          </Button>
        </>
      );
    }

    // Default actions
    return (
      <>
        <Button onClick={handleReset} className="min-h-[56px] flex-1 text-base" variant="default" size="lg">
          Try Again
        </Button>
        <Button onClick={handleGoHome} className="min-h-[56px] flex-1 text-base" variant="outline" size="lg">
          Go Home
        </Button>
      </>
    );
  },

  getIcon: (): ReactNode => (
    <svg className="mr-2 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
};
