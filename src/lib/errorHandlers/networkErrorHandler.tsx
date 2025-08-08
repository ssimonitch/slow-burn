/**
 * Network error handler
 *
 * Handles network-related errors with connection-specific recovery actions
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { isApiError, isPWAError } from '@/lib/errors';
import { toast } from '@/lib/toast';

import type { ErrorHandler } from './types';

export const networkErrorHandler: ErrorHandler = {
  priority: 5, // Medium priority

  canHandle: (error: Error): boolean => {
    // Check for API errors with network issues
    if (isApiError(error) && error.isNetworkError()) {
      return true;
    }

    // Check for PWA offline errors
    if (isPWAError(error) && error.type === 'offline') {
      return true;
    }

    // Check for common network error patterns
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('offline') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('cors') ||
      !navigator.onLine
    );
  },

  getTitle: (error: Error): string => {
    if (!navigator.onLine) {
      return "You're Offline";
    }

    const message = error.message.toLowerCase();
    if (message.includes('timeout')) {
      return 'Request Timed Out';
    }
    if (message.includes('cors')) {
      return 'Connection Blocked';
    }

    return 'Connection Problem';
  },

  getDescription: (error: Error): string => {
    if (!navigator.onLine) {
      return "It looks like you're offline. Check your internet connection and try again.";
    }

    const message = error.message.toLowerCase();
    if (message.includes('timeout')) {
      return 'The request took too long to complete. The server might be busy or your connection might be slow.';
    }
    if (message.includes('cors')) {
      return 'The request was blocked for security reasons. This might be a configuration issue.';
    }

    return 'Unable to connect to the server. Please check your internet connection and try again.';
  },

  getActions: (_error: Error, reset: () => void): ReactNode => {
    const handleRetry = () => {
      // If we're offline, check connection first
      if (!navigator.onLine) {
        toast.error('Still offline', {
          description: 'Please connect to the internet first.',
        });
        return;
      }
      reset();
    };

    const handleRefresh = () => {
      window.location.reload();
    };

    return (
      <>
        <Button onClick={handleRetry} className="min-h-[56px] flex-1 text-base" variant="default" size="lg">
          Try Again
        </Button>
        <Button onClick={handleRefresh} className="min-h-[56px] flex-1 text-base" variant="outline" size="lg">
          Refresh Page
        </Button>
      </>
    );
  },

  onCatch: (): void => {
    // Show network-specific toast
    if (!navigator.onLine) {
      toast.error("You're offline", {
        description: 'Some features may not be available.',
      });
    } else {
      toast.error('Connection problem', {
        description: 'Having trouble connecting to the server.',
      });
    }
  },

  getIcon: (): ReactNode => (
    <svg className="mr-2 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
      />
    </svg>
  ),
};
