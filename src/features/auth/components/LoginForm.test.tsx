/**
 * Unit Tests for LoginForm Component
 *
 * These tests verify the login form functionality, including:
 * - Form validation (email format, required fields)
 * - User interactions (form submission, navigation clicks)
 * - Auth store integration (sign in, error handling, loading states)
 * - Accessibility features (ARIA labels, semantic elements)
 * - Error messaging and loading states
 *
 * Note: Uses existing test utilities from @/test/factories/auth.ts for consistent mocking
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthErrorCode } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { createMockSupabaseError } from '@/test/factories/auth';
import { render } from '@/test/helpers/render';

import { LoginForm } from './LoginForm';

// Mock the auth store
vi.mock('@/stores/auth.store');

describe('LoginForm', () => {
  const mockSignIn = vi.fn();
  const mockClearError = vi.fn();
  const mockUseAuthStore = vi.mocked(useAuthStore);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      signIn: mockSignIn,
      clearError: mockClearError,
      loading: { signIn: false },
      error: null,
    });
  });

  it('renders the login form with all required fields', () => {
    render(<LoginForm />);

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
  });

  it('validates email field is required', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    // Try to submit with invalid email
    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'not-an-email');
    await user.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // The form should not call signIn with invalid email
    await waitFor(() => {
      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });

  it('validates password is required', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const emailInput = screen.getByLabelText('Email address');
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('calls signIn with correct credentials on form submission', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = vi.fn();

    mockSignIn.mockResolvedValue(undefined);

    render(<LoginForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled();
      expect(mockSignIn).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('displays error message when authentication fails', () => {
    const authError = createMockSupabaseError({
      message: 'Invalid credentials',
    });

    mockUseAuthStore.mockReturnValue({
      signIn: mockSignIn,
      clearError: mockClearError,
      loading: { signIn: false },
      error: {
        message: authError.message,
        code: AuthErrorCode.INVALID_CREDENTIALS,
      },
    });

    render(<LoginForm />);

    expect(screen.getByText('Invalid email or password. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
  });

  it('disables form inputs and shows loading state during submission', () => {
    mockUseAuthStore.mockReturnValue({
      signIn: mockSignIn,
      clearError: mockClearError,
      loading: { signIn: true },
      error: null,
    });

    render(<LoginForm />);

    expect(screen.getByLabelText('Email address')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
  });

  it('provides link to sign up page', () => {
    render(<LoginForm />);

    const signUpLink = screen.getByRole('link', { name: /sign up/i });
    expect(signUpLink).toHaveAttribute('href', '/signup');
  });

  it('provides link to forgot password page', () => {
    render(<LoginForm />);

    const forgotPasswordLink = screen.getByRole('link', { name: /forgot your password/i });
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  it('preserves redirect URL in navigation links when provided', () => {
    render(<LoginForm redirectUrl="/dashboard" />);

    const signUpLink = screen.getByRole('link', { name: /sign up/i });
    expect(signUpLink).toHaveAttribute('href', '/signup?from=/dashboard');

    const forgotPasswordLink = screen.getByRole('link', { name: /forgot your password/i });
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password?from=/dashboard');
  });

  describe('accessibility', () => {
    it('has proper ARIA labels and semantic structure', () => {
      render(<LoginForm />);

      // Form has proper structure (using querySelector since form might not have role attribute)
      expect(document.querySelector('form')).toBeInTheDocument();

      // Inputs have proper labels
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();

      // Button has proper role and text
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Tab through form elements
      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });
  });

  describe('error handling', () => {
    it.each([
      [AuthErrorCode.NETWORK_ERROR, 'No internet connection. Please check your network and try again.'],
      [AuthErrorCode.OFFLINE, 'No internet connection. Please check your network and try again.'],
      [AuthErrorCode.RATE_LIMITED, 'Too many login attempts. Please wait a few minutes and try again.'],
      [AuthErrorCode.EMAIL_NOT_CONFIRMED, 'Please confirm your email address before logging in.'],
    ])('displays correct error message for %s', (errorCode, expectedMessage) => {
      mockUseAuthStore.mockReturnValue({
        signIn: mockSignIn,
        clearError: mockClearError,
        loading: { signIn: false },
        error: {
          message: 'Test error',
          code: errorCode,
        },
      });

      render(<LoginForm />);

      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('displays generic error message for unknown error codes', () => {
      mockUseAuthStore.mockReturnValue({
        signIn: mockSignIn,
        clearError: mockClearError,
        loading: { signIn: false },
        error: {
          message: 'Unknown error',
          code: 'UNKNOWN_ERROR' as AuthErrorCode,
        },
      });

      render(<LoginForm />);

      expect(screen.getByText('Unknown error')).toBeInTheDocument();
    });

    it('clears errors when form is submitted', async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValue(undefined);

      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      expect(mockClearError).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles form submission when store methods throw errors', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty to suppress console errors during test
      });

      mockSignIn.mockRejectedValue(new Error('Network error'));

      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    it('validates email format before allowing submission', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(emailInput, 'invalid-email');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // The form should prevent submission with invalid email
      // Wait a bit to let validation run
      await waitFor(
        () => {
          expect(mockSignIn).not.toHaveBeenCalled();
        },
        { timeout: 2000 },
      );

      // Form validation should prevent the call
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('disables navigation links during loading', () => {
      mockUseAuthStore.mockReturnValue({
        signIn: mockSignIn,
        clearError: mockClearError,
        loading: { signIn: true },
        error: null,
      });

      render(<LoginForm />);

      expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
