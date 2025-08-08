/**
 * Authentication error handler
 *
 * Handles authentication-specific errors with appropriate recovery actions
 */

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { authToast, toast } from '@/lib/toast';
import { AuthError, AuthErrorCode, isAuthError } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';

import type { ErrorHandler } from './types';

export const authErrorHandler: ErrorHandler = {
  priority: 10, // Higher priority to check auth errors first

  canHandle: (error: Error): boolean => {
    // Check for our custom AuthError from auth.service
    if (error instanceof AuthError) {
      return true;
    }
    // Check for generic auth error from lib/errors
    if (isAuthError(error)) {
      return true;
    }
    // Check for auth-related message patterns
    const message = error.message.toLowerCase();
    return (
      message.includes('auth') ||
      message.includes('session') ||
      message.includes('token') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    );
  },

  getTitle: (error: Error): string => {
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.SESSION_EXPIRED:
          return 'Session Expired';
        case AuthErrorCode.INVALID_CREDENTIALS:
          return 'Invalid Credentials';
        case AuthErrorCode.EMAIL_NOT_CONFIRMED:
          return 'Email Not Confirmed';
        case AuthErrorCode.NO_SESSION:
          return 'Not Signed In';
        case AuthErrorCode.RATE_LIMITED:
          return 'Too Many Attempts';
        default:
          return 'Authentication Error';
      }
    }
    return 'Authentication Error';
  },

  getDescription: (error: Error): string => {
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.SESSION_EXPIRED:
          return 'Your session has expired. Please sign in again to continue.';
        case AuthErrorCode.INVALID_CREDENTIALS:
          return 'Invalid email or password. Please try again.';
        case AuthErrorCode.EMAIL_NOT_CONFIRMED:
          return 'Please confirm your email address before signing in.';
        case AuthErrorCode.NO_SESSION:
          return 'You need to sign in to access this page.';
        case AuthErrorCode.RATE_LIMITED:
          return 'Too many attempts. Please wait a few minutes and try again.';
        case AuthErrorCode.NETWORK_ERROR:
        case AuthErrorCode.OFFLINE:
          return 'Unable to connect to the authentication server. Please check your connection.';
        default:
          return 'There was a problem with your authentication. Please try signing in again.';
      }
    }
    return 'There was a problem with your authentication. Please try signing in again.';
  },

  getActions: (error: Error, reset: () => void, navigate?: (path: string) => void): ReactNode => {
    const isSessionError =
      error instanceof AuthError &&
      (error.code === AuthErrorCode.SESSION_EXPIRED || error.code === AuthErrorCode.NO_SESSION);

    const handleSignOut = async () => {
      const { signOut } = useAuthStore.getState();
      try {
        await signOut();
        reset();
      } catch {
        // If sign out fails, just reset anyway
        reset();
      }
    };

    const handleSignIn = () => {
      if (navigate) {
        navigate('/login');
      } else {
        window.location.href = '/login';
      }
    };

    if (isSessionError) {
      return (
        <>
          <Button onClick={handleSignIn} className="min-h-[56px] flex-1 text-base" variant="default" size="lg">
            Sign In Again
          </Button>
          <Button
            onClick={() => void handleSignOut()}
            className="min-h-[56px] flex-1 text-base"
            variant="outline"
            size="lg"
          >
            Sign Out
          </Button>
        </>
      );
    }

    // For other auth errors, show try again and go home
    return (
      <>
        <Button onClick={reset} className="min-h-[56px] flex-1 text-base" variant="default" size="lg">
          Try Again
        </Button>
        <Button
          onClick={() => (navigate ? navigate('/') : (window.location.href = '/'))}
          className="min-h-[56px] flex-1 text-base"
          variant="outline"
          size="lg"
        >
          Go Home
        </Button>
      </>
    );
  },

  onCatch: (error: Error): void => {
    // Show appropriate toast notification
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.SESSION_EXPIRED:
          authToast.sessionExpired();
          break;
        case AuthErrorCode.NETWORK_ERROR:
        case AuthErrorCode.OFFLINE:
          toast.error('Connection lost', {
            description: 'Please check your internet connection.',
          });
          break;
        case AuthErrorCode.RATE_LIMITED:
          toast.error('Too many attempts', {
            description: 'Please wait a few minutes and try again.',
          });
          break;
        default:
          toast.error('Authentication error', {
            description: 'Please try signing in again.',
          });
      }
    } else if (isAuthError(error)) {
      toast.error('Authentication error', {
        description: 'Please try signing in again.',
      });
    }
  },

  getIcon: (): ReactNode => (
    <svg className="mr-2 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  ),
};
