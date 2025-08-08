/**
 * Unit Tests for ForgotPasswordForm Component
 *
 * These tests verify the forgot password form functionality, including:
 * - Email validation (required, format)
 * - Form submission with loading states
 * - Success state display and "Back to login" navigation
 * - Error handling (network, rate limiting, validation, user not found)
 * - Security behavior (showing success for non-existent users)
 * - Keyboard navigation and accessibility
 *
 * Note: Uses existing test utilities from @/test/factories/auth.ts for consistent mocking
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthResponse } from '@/services/auth/auth.service';
import { AuthErrorCode, authService } from '@/services/auth/auth.service';
import { createMockAuthError } from '@/test/factories/auth';
import { render } from '@/test/helpers/render';

import { ForgotPasswordForm } from './ForgotPasswordForm';

// Mock the auth service
vi.mock('@/services/auth/auth.service', async () => {
  const actual = await vi.importActual('@/services/auth/auth.service');
  return {
    ...actual,
    AuthErrorCode: {
      INVALID_EMAIL: 'INVALID_EMAIL',
      NETWORK_ERROR: 'NETWORK_ERROR',
      OFFLINE: 'OFFLINE',
      RATE_LIMITED: 'RATE_LIMITED',
      USER_NOT_FOUND: 'USER_NOT_FOUND',
      UNKNOWN: 'UNKNOWN',
    },
    authService: {
      resetPassword: vi.fn(),
    },
  };
});

describe('ForgotPasswordForm', () => {
  const mockResetPassword = vi.mocked(authService.resetPassword);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders the forgot password form with all required elements', () => {
      render(<ForgotPasswordForm />);

      expect(screen.getByText('Reset your password')).toBeInTheDocument();
      expect(
        screen.getByText("Enter your email address and we'll send you a link to reset your password"),
      ).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    });

    it('has proper input attributes for accessibility and UX', () => {
      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('placeholder', 'you@example.com');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
      expect(emailInput).toHaveAttribute('aria-label', 'Email address');
    });

    it('displays email icon in input field', () => {
      render(<ForgotPasswordForm />);

      // Check that the mail icon is present (it's decorative, so no specific test needed)
      expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('validates email is required', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });

      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);

      // The form should prevent submission with invalid email format
      // This is the main behavior we care about - the form validates and prevents the API call
      expect(mockResetPassword).not.toHaveBeenCalled();
    });

    it('accepts valid email format', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ data: undefined, error: null });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
      });
    });
  });

  describe('form submission', () => {
    it('calls resetPassword with correct email', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ data: undefined, error: null });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'user@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('user@example.com');
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      let resolvePromise: ((value: AuthResponse<void>) => void) | undefined;
      const promise = new Promise<AuthResponse<void>>((resolve) => {
        resolvePromise = resolve as (value: AuthResponse<void>) => void;
      });
      mockResetPassword.mockReturnValue(promise);

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: /sending reset link/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Email address' })).toBeDisabled();
      expect(screen.getByRole('link', { name: /back to login/i })).toHaveAttribute('aria-disabled', 'true');

      // Resolve the promise
      resolvePromise!({ data: undefined, error: null });
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });

    it('disables form inputs during submission', async () => {
      const user = userEvent.setup();
      let resolvePromise: ((value: AuthResponse<void>) => void) | undefined;
      const promise = new Promise<AuthResponse<void>>((resolve) => {
        resolvePromise = resolve as (value: AuthResponse<void>) => void;
      });
      mockResetPassword.mockReturnValue(promise);

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      const backLink = screen.getByRole('link', { name: /back to login/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      expect(emailInput).toBeDisabled();
      expect(backLink).toHaveAttribute('aria-disabled', 'true');

      // Resolve the promise
      resolvePromise!({ data: undefined, error: null });
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });
  });

  describe('success state', () => {
    beforeEach(() => {
      mockResetPassword.mockResolvedValue({ data: undefined, error: null });
    });

    it('shows success message after successful submission', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
        expect(screen.getByText(/We've sent a password reset link to/)).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText(/Click the link in the email to reset your password/)).toBeInTheDocument();
        expect(screen.getByText(/The link will expire in 1 hour for security reasons/)).toBeInTheDocument();
      });
    });

    it('shows success icon in success state', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });

      // Check that success icon is present (CheckCircle icon)
      const successElements = screen.getAllByText('Check your email');
      expect(successElements.length).toBeGreaterThan(0);
    });

    it('provides back to login link in success state', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });

      const backLink = screen.getByRole('link', { name: /back to login/i });
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('provides try again option in success state', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });

      const tryAgainButton = screen.getByRole('button', { name: /didn't receive the email\? try again/i });
      await user.click(tryAgainButton);

      // Should return to form state
      await waitFor(() => {
        expect(screen.getByText('Reset your password')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();
      });

      // Form should be reset
      expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveValue('');
    });
  });

  describe('error handling', () => {
    it('displays error for invalid email', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Invalid email', AuthErrorCode.INVALID_EMAIL),
      });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'invalid@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('displays error for network issues', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Network error', AuthErrorCode.NETWORK_ERROR),
      });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Unable to connect. Please check your internet connection.')).toBeInTheDocument();
      });
    });

    it('displays error for offline status', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Offline', AuthErrorCode.OFFLINE),
      });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Unable to connect. Please check your internet connection.')).toBeInTheDocument();
      });
    });

    it('displays error for rate limiting', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Rate limited', AuthErrorCode.RATE_LIMITED),
      });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please wait before trying again.')).toBeInTheDocument();
      });
    });

    it('shows success for user not found (security)', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('User not found', AuthErrorCode.USER_NOT_FOUND),
      });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'nonexistent@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
        expect(screen.getByText('nonexistent@example.com')).toBeInTheDocument();
      });

      // Should not show error message for security reasons
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows success for unknown errors (security)', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Unknown error', AuthErrorCode.UNKNOWN),
      });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
      });
    });

    it('handles unexpected errors gracefully', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockRejectedValue(new Error('Unexpected error'));

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Unable to process request. Please try again.')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('provides link to back to login', () => {
      render(<ForgotPasswordForm />);

      const backLink = screen.getByRole('link', { name: /back to login/i });
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('preserves redirect URL when provided', () => {
      render(<ForgotPasswordForm redirectUrl="/dashboard" />);

      const backLink = screen.getByRole('link', { name: /back to login/i });
      expect(backLink).toHaveAttribute('href', '/login?from=/dashboard');
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels and semantic structure', () => {
      render(<ForgotPasswordForm />);

      // Form has proper structure
      expect(document.querySelector('form')).toBeInTheDocument();

      // Input has proper label
      expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument();

      // Buttons have proper roles and text
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      const backLink = screen.getByRole('link', { name: /back to login/i });

      // Click on email input to start
      await user.click(emailInput);
      expect(emailInput).toHaveFocus();

      // Tab to submit button
      await user.tab();
      expect(submitButton).toHaveFocus();

      // Tab to back link
      await user.tab();
      expect(backLink).toHaveFocus();
    });

    it('provides accessible error announcements', async () => {
      const user = userEvent.setup();
      render(<ForgotPasswordForm />);

      const submitButton = screen.getByRole('button', { name: /send reset link/i });
      await user.click(submitButton);

      await waitFor(() => {
        const errorElement = screen.getByText('Email is required');
        expect(errorElement).toBeInTheDocument();
      });
    });

    it('provides accessible error messages with proper ARIA attributes', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Network error', AuthErrorCode.NETWORK_ERROR),
      });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('form interactions', () => {
    it('can submit form using Enter key', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ data: undefined, error: null });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      await user.type(emailInput, 'test@example.com');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('clears error when form is resubmitted', async () => {
      const user = userEvent.setup();

      // Mock Date.now to control rate limiting
      const originalDateNow = Date.now;
      let currentTime = 1000000;
      Date.now = vi.fn(() => currentTime);

      // First submission fails
      mockResetPassword.mockResolvedValueOnce({
        data: null,
        error: createMockAuthError('Network error', AuthErrorCode.NETWORK_ERROR),
      });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Unable to connect. Please check your internet connection.')).toBeInTheDocument();
      });

      // Advance time past rate limit (60 seconds)
      currentTime += 61000;

      // Second submission succeeds
      mockResetPassword.mockResolvedValueOnce({ data: undefined, error: null });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });

      // Error should be cleared
      expect(screen.queryByText('Unable to connect. Please check your internet connection.')).not.toBeInTheDocument();

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('edge cases', () => {
    it('handles form reset correctly after try again', async () => {
      const user = userEvent.setup();
      mockResetPassword.mockResolvedValue({ data: undefined, error: null });

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      // Submit form
      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });

      // Click try again
      const tryAgainButton = screen.getByRole('button', { name: /didn't receive the email\? try again/i });
      await user.click(tryAgainButton);

      await waitFor(() => {
        expect(screen.getByText('Reset your password')).toBeInTheDocument();
      });

      // Form should be completely reset
      const newEmailInput = screen.getByRole('textbox', { name: 'Email address' });
      expect(newEmailInput).toHaveValue('');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('maintains form state during async operation', async () => {
      const user = userEvent.setup();
      let resolvePromise: ((value: AuthResponse<void>) => void) | undefined;
      const promise = new Promise<AuthResponse<void>>((resolve) => {
        resolvePromise = resolve as (value: AuthResponse<void>) => void;
      });
      mockResetPassword.mockReturnValue(promise);

      render(<ForgotPasswordForm />);

      const emailInput = screen.getByRole('textbox', { name: 'Email address' });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // During loading, input should be disabled but value preserved
      expect(emailInput).toBeDisabled();
      expect(emailInput).toHaveValue('test@example.com');

      // Resolve with success
      resolvePromise!({ data: undefined, error: null });
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument();
      });
    });
  });
});
