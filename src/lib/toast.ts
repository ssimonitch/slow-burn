/**
 * Toast notification utilities for user feedback
 *
 * This module provides a centralized way to show toast notifications
 * throughout the application. It wraps the sonner library with our
 * custom styling and provides typed methods for different notification types.
 */

import type React from 'react';
import { type ExternalToast, toast as sonnerToast } from 'sonner';

import { getErrorMessage, isApiError } from '@/lib/errors';
import { AuthErrorCode, isAuthError } from '@/services/auth/auth.service';

/**
 * Toast notification options
 */
interface ToastOptions {
  /**
   * Duration in milliseconds. Set to Infinity for persistent toasts.
   * Default: 4000 for regular toasts, 5000 for errors
   */
  duration?: number;
  /**
   * Description text shown below the main message
   */
  description?: string;
  /**
   * Action button configuration
   */
  action?: {
    label: string;
    onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  };
  /**
   * Cancel button configuration
   */
  cancel?: {
    label: string;
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  };
  /**
   * Position on screen
   */
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

/**
 * Default durations for different toast types
 */
const DEFAULT_DURATIONS = {
  success: 4000,
  error: 5000,
  warning: 4500,
  info: 4000,
  loading: Infinity,
} as const;

/**
 * Toast notification utilities
 */
export const toast = {
  /**
   * Show a success toast
   */
  success: (message: string, options?: ToastOptions) => {
    const toastOptions: ExternalToast = {
      duration: options?.duration ?? DEFAULT_DURATIONS.success,
      description: options?.description,
      position: options?.position,
    };

    if (options?.action) {
      toastOptions.action = {
        label: options.action.label,
        onClick: options.action.onClick,
      };
    }

    if (options?.cancel) {
      toastOptions.cancel = {
        label: options.cancel.label,
        onClick: options.cancel.onClick ?? (() => undefined),
      };
    }

    return sonnerToast.success(message, toastOptions);
  },

  /**
   * Show an error toast
   */
  error: (message: string, options?: ToastOptions) => {
    const toastOptions: ExternalToast = {
      duration: options?.duration ?? DEFAULT_DURATIONS.error,
      description: options?.description,
      position: options?.position,
    };

    if (options?.action) {
      toastOptions.action = {
        label: options.action.label,
        onClick: options.action.onClick,
      };
    }

    if (options?.cancel) {
      toastOptions.cancel = {
        label: options.cancel.label,
        onClick: options.cancel.onClick ?? (() => undefined),
      };
    }

    return sonnerToast.error(message, toastOptions);
  },

  /**
   * Show a warning toast
   */
  warning: (message: string, options?: ToastOptions) => {
    const toastOptions: ExternalToast = {
      duration: options?.duration ?? DEFAULT_DURATIONS.warning,
      description: options?.description,
      position: options?.position,
    };

    if (options?.action) {
      toastOptions.action = {
        label: options.action.label,
        onClick: options.action.onClick,
      };
    }

    if (options?.cancel) {
      toastOptions.cancel = {
        label: options.cancel.label,
        onClick: options.cancel.onClick ?? (() => undefined),
      };
    }

    return sonnerToast.warning(message, toastOptions);
  },

  /**
   * Show an info toast
   */
  info: (message: string, options?: ToastOptions) => {
    const toastOptions: ExternalToast = {
      duration: options?.duration ?? DEFAULT_DURATIONS.info,
      description: options?.description,
      position: options?.position,
    };

    if (options?.action) {
      toastOptions.action = {
        label: options.action.label,
        onClick: options.action.onClick,
      };
    }

    if (options?.cancel) {
      toastOptions.cancel = {
        label: options.cancel.label,
        onClick: options.cancel.onClick ?? (() => undefined),
      };
    }

    return sonnerToast.info(message, toastOptions);
  },

  /**
   * Show a loading toast with a spinner
   * Returns a function to update or dismiss the toast
   */
  loading: (message: string, options?: Omit<ToastOptions, 'duration'>) => {
    return sonnerToast.loading(message, {
      duration: DEFAULT_DURATIONS.loading,
      description: options?.description,
      position: options?.position,
    });
  },

  /**
   * Show a promise-based toast that updates based on promise resolution
   */
  promise: <T>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
    options?: Omit<ToastOptions, 'description'>,
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error,
      position: options?.position,
    });
  },

  /**
   * Dismiss a specific toast or all toasts
   */
  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  },

  /**
   * Show an error toast from an Error object
   * Automatically extracts user-friendly messages from our custom error types
   */
  fromError: (error: unknown, fallbackMessage = 'An unexpected error occurred') => {
    let message = fallbackMessage;
    let description: string | undefined;

    // Handle our custom error types
    if (isApiError(error)) {
      message = error.getUserMessage();
      if (error.isNetworkError()) {
        description = 'Please check your internet connection and try again.';
      } else if (error.isAuthError()) {
        description = 'You may need to sign in again.';
      } else if (error.status === 429) {
        description = 'Please wait a moment before trying again.';
      }
    } else if (isAuthError(error)) {
      message = error.getUserMessage();
      if (error.code === AuthErrorCode.EMAIL_NOT_CONFIRMED) {
        description = 'Check your email for a confirmation link.';
      }
    } else {
      // For other errors, use the generic error message extractor
      message = getErrorMessage(error);
    }

    return toast.error(message, { description });
  },
};

/**
 * Authentication-specific toast notifications
 */
export const authToast = {
  /**
   * Show success toast for login
   */
  loginSuccess: (userName?: string) => {
    const message = userName ? `Welcome back, ${userName}!` : 'Successfully signed in!';
    toast.success(message);
  },

  /**
   * Show success toast for signup
   */
  signupSuccess: () => {
    toast.success('Account created successfully!', {
      description: 'Please check your email to confirm your account.',
    });
  },

  /**
   * Show success toast for password reset email
   */
  passwordResetEmailSent: (email: string) => {
    toast.success('Password reset email sent', {
      description: `Check ${email} for instructions to reset your password.`,
      duration: 6000,
    });
  },

  /**
   * Show success toast for password reset
   */
  passwordResetSuccess: () => {
    toast.success('Password reset successfully!', {
      description: 'You can now sign in with your new password.',
    });
  },

  /**
   * Show warning toast for session expiration
   */
  sessionExpired: () => {
    toast.warning('Your session has expired', {
      description: 'Please sign in again to continue.',
      action: {
        label: 'Sign In',
        onClick: () => {
          window.location.href = '/login';
        },
      },
    });
  },

  /**
   * Show error toast for rate limiting
   */
  rateLimited: (retryAfter?: number) => {
    const description = retryAfter
      ? `Please try again in ${Math.ceil(retryAfter / 60)} minutes.`
      : 'Please try again in a few minutes.';

    toast.error('Too many attempts', {
      description,
      duration: 6000,
    });
  },

  /**
   * Show info toast for email confirmation reminder
   */
  emailNotConfirmed: () => {
    toast.info('Please confirm your email', {
      description: 'Check your inbox for a confirmation link to activate your account.',
      duration: 6000,
    });
  },
};

/**
 * Network-specific toast notifications
 */
export const networkToast = {
  /**
   * Show offline toast
   */
  offline: () => {
    toast.error('No internet connection', {
      description: 'Some features may be limited while offline.',
      duration: 6000,
    });
  },

  /**
   * Show online toast (after being offline)
   */
  online: () => {
    toast.success('Connection restored', {
      description: 'You are back online.',
    });
  },

  /**
   * Show slow connection warning
   */
  slowConnection: () => {
    toast.warning('Slow connection detected', {
      description: 'This may take longer than usual.',
    });
  },
};
