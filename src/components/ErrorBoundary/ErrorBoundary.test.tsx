/**
 * Unit Tests for Unified ErrorBoundary Component
 *
 * These tests verify the composable error boundary functionality, including:
 * - Error catching and display
 * - Handler selection based on error type
 * - Custom fallback rendering
 * - Recovery mechanisms
 * - Development mode error details
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Component } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthError, AuthErrorCode } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';

import { ErrorBoundary, ErrorBoundaryWrapper } from './ErrorBoundary';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}));

// Mock the toast library
vi.mock('@/lib/toast', () => ({
  toast: {
    error: vi.fn(),
  },
  authToast: {
    sessionExpired: vi.fn(),
  },
}));

// Mock the auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      signOut: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Test component that throws an error
class ThrowError extends Component<{ error: Error }> {
  componentDidMount() {
    throw this.props.error;
  }
  render() {
    return <div>This should not render</div>;
  }
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error catching', () => {
    it('should catch and display generic errors', () => {
      const error = new Error('Test error');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
      // Check for Try Again button which should always be present
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go Home' })).toBeInTheDocument();
    });

    it('should catch and display authentication errors', () => {
      const error = new AuthError('Session expired', AuthErrorCode.SESSION_EXPIRED);

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Session Expired')).toBeInTheDocument();
      expect(screen.getByText(/Your session has expired/)).toBeInTheDocument();
    });

    it('should use custom fallback when provided', () => {
      const error = new Error('Test error');
      const customFallback = <div>Custom Error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    });
  });

  describe('handler selection', () => {
    it('should select auth handler for auth errors', () => {
      const error = new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Invalid Credentials')).toBeInTheDocument();
    });

    it('should select network handler for offline errors', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const error = new Error('Network error');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      expect(screen.getByText("You're Offline")).toBeInTheDocument();

      // Restore navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
    });

    it('should fall back to default handler for unknown errors', () => {
      const error = new Error('Some random error');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    });
  });

  describe('recovery actions', () => {
    it('should have Try Again button that calls reset', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();

      // Verify Try Again button exists and is clickable
      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });
      expect(tryAgainButton).toBeInTheDocument();
      expect(tryAgainButton).not.toBeDisabled();

      // Clicking will attempt to reset but error will re-throw in test
      await user.click(tryAgainButton);

      // After click, error should still be displayed (because ThrowError always throws)
      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    });

    it('should navigate to home when Go Home is clicked', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');

      // Mock window.location.href
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mocking window.location for testing
      delete (window as any).location;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mocking window.location for testing
      window.location = { href: '' } as any;

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      await user.click(screen.getByRole('button', { name: 'Go Home' }));

      expect(window.location.href).toBe('/');
    });

    it('should handle sign out for session errors', async () => {
      const user = userEvent.setup();
      const error = new AuthError('Session expired', AuthErrorCode.SESSION_EXPIRED);
      const mockSignOut = vi.fn().mockResolvedValue(undefined);

      vi.mocked(useAuthStore.getState).mockReturnValue({
        signOut: mockSignOut,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Partial mock for testing
      } as any);

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      await user.click(screen.getByRole('button', { name: 'Sign Out' }));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
    });
  });

  describe('development mode', () => {
    it('should show error details in development mode', () => {
      // Mock import.meta.env.DEV
      const originalEnv = import.meta.env.DEV;
      vi.stubGlobal('import.meta.env', { DEV: true });

      const error = new Error('Test error with stack');
      error.stack = 'Error stack trace';

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      // In dev mode, details should be visible
      expect(screen.getByText('Error details (development only)')).toBeInTheDocument();

      // Restore original env
      vi.stubGlobal('import.meta.env', { DEV: originalEnv });
    });

    it('should not show error details in production', () => {
      // Mock import.meta.env.DEV for production
      const originalEnv = import.meta.env.DEV;
      vi.stubGlobal('import.meta.env', { DEV: false });

      const error = new Error('Test error');

      render(
        <ErrorBoundary showDevDetails={false}>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      expect(screen.queryByText('Error details (development only)')).not.toBeInTheDocument();

      // Restore original env
      vi.stubGlobal('import.meta.env', { DEV: originalEnv });
    });
  });

  describe('ErrorBoundaryWrapper', () => {
    it('should work without router context', () => {
      const error = new Error('Test error');

      render(
        <ErrorBoundaryWrapper>
          <ThrowError error={error} />
        </ErrorBoundaryWrapper>,
      );

      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    });

    it('should work with router context', () => {
      const error = new Error('Test error');

      render(
        <BrowserRouter>
          <ErrorBoundaryWrapper>
            <ThrowError error={error} />
          </ErrorBoundaryWrapper>
        </BrowserRouter>,
      );

      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
    });

    it('should pass custom handlers', () => {
      const error = new Error('Test error');
      const customHandler = {
        canHandle: () => true,
        getTitle: () => 'Custom Title',
        getDescription: () => 'Custom Description',
        getActions: () => <button type="button">Custom Action</button>,
        priority: 100,
      };

      render(
        <ErrorBoundaryWrapper handlers={[customHandler]}>
          <ThrowError error={error} />
        </ErrorBoundaryWrapper>,
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom Description')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Custom Action' })).toBeInTheDocument();
    });
  });

  describe('fitness-optimized UI', () => {
    it('should have large touch targets for buttons', () => {
      const error = new Error('Test error');

      render(
        <ErrorBoundary>
          <ThrowError error={error} />
        </ErrorBoundary>,
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveClass('min-h-[56px]');
      });
    });
  });
});
