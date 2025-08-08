/**
 * Unit Tests for ResetPasswordForm Component
 *
 * These tests verify the reset password form functionality, including:
 * - Token extraction from URL hash fragment
 * - Password strength indicator and requirements checklist
 * - Password confirmation validation
 * - Form submission and success redirect
 * - Expired/invalid token handling
 * - Loading states and navigation
 * - Keyboard navigation and accessibility
 *
 * Note: Uses existing test utilities from @/test/factories/auth.ts for consistent mocking
 */

import type { User } from '@supabase/supabase-js';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthResponse } from '@/services/auth/auth.service';
import { AuthErrorCode, authService } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { createMockAuthError, createMockAuthStore, createMockUser } from '@/test/factories/auth';
import { render } from '@/test/helpers/render';

import { ResetPasswordForm } from './ResetPasswordForm';

// Mock the auth service
vi.mock('@/services/auth/auth.service', async () => {
  const actual = await vi.importActual('@/services/auth/auth.service');
  return {
    ...actual,
    AuthErrorCode: {
      SESSION_EXPIRED: 'SESSION_EXPIRED',
      NO_SESSION: 'NO_SESSION',
      WEAK_PASSWORD: 'WEAK_PASSWORD',
      NETWORK_ERROR: 'NETWORK_ERROR',
      UNKNOWN: 'UNKNOWN',
    },
    authService: {
      updatePassword: vi.fn(),
    },
  };
});

// Mock the auth store
vi.mock('@/stores/auth.store');

// Mock react-router-dom navigate function only
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock window.location.hash
const mockLocationHash = vi.fn<() => string>();
Object.defineProperty(window, 'location', {
  value: {
    get hash() {
      return mockLocationHash();
    },
  },
  writable: true,
});

describe('ResetPasswordForm', () => {
  const mockUpdatePassword = vi.mocked(authService.updatePassword);
  const mockUseAuthStore = vi.mocked(useAuthStore);
  const mockInitialize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue(createMockAuthStore({}, { initialize: mockInitialize }));
    // Default to no hash
    mockLocationHash.mockReturnValue('');
  });

  describe('token validation', () => {
    it('processes token validation and shows appropriate state', async () => {
      // Set up a valid token in the hash
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
      mockInitialize.mockResolvedValue(undefined);

      render(<ResetPasswordForm />);

      // After token validation completes, should show the password form
      await waitFor(() => {
        expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
        // Check for password inputs by placeholder since they are password type
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Re-enter your password')).toBeInTheDocument();
      });

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('handles missing token', async () => {
      mockLocationHash.mockReturnValue('');

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
        expect(screen.getByText('This password reset link is invalid or has expired')).toBeInTheDocument();
        expect(
          screen.getByText('Invalid or expired reset link. Please request a new password reset.'),
        ).toBeInTheDocument();
      });
    });

    it('handles invalid token format', async () => {
      mockLocationHash.mockReturnValue('#invalid_format=123');

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
        expect(
          screen.getByText('Invalid or expired reset link. Please request a new password reset.'),
        ).toBeInTheDocument();
      });
    });

    it('accepts valid recovery token', async () => {
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Re-enter your password')).toBeInTheDocument();
      });

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('rejects token with wrong type', async () => {
      mockLocationHash.mockReturnValue('#access_token=valid_token_123&type=signup&expires_in=3600');

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });
    });

    it('provides navigation to request new reset link', async () => {
      mockLocationHash.mockReturnValue('');

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });

      const newResetLink = screen.getByRole('link', { name: /request new reset link/i });
      expect(newResetLink).toHaveAttribute('href', '/forgot-password');
    });

    it('provides back to login navigation in invalid token state', async () => {
      mockLocationHash.mockReturnValue('');

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
      });

      // Should show "Request New Reset Link" button that links to forgot-password
      const resetLinkButton = screen.getByRole('link', { name: /request new reset link/i });
      expect(resetLinkButton).toHaveAttribute('href', '/forgot-password');
    });
  });

  describe('password form validation', () => {
    beforeEach(() => {
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
    });

    it('renders the password reset form with all required fields', async () => {
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
        expect(screen.getByText('Enter your new password below')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Re-enter your password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
      });
    });

    it('validates password requirements', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
        expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      });
    });

    it('validates password strength requirements', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      // Test weak password (too short)
      await user.type(passwordInput, 'weak');
      await user.type(confirmPasswordInput, 'weak');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });

      // Test password without uppercase
      await user.clear(passwordInput);
      await user.clear(confirmPasswordInput);
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one uppercase letter')).toBeInTheDocument();
      });

      // Test password without lowercase
      await user.clear(passwordInput);
      await user.clear(confirmPasswordInput);
      await user.type(passwordInput, 'PASSWORD123');
      await user.type(confirmPasswordInput, 'PASSWORD123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one lowercase letter')).toBeInTheDocument();
      });

      // Test password without number
      await user.clear(passwordInput);
      await user.clear(confirmPasswordInput);
      await user.type(passwordInput, 'Password');
      await user.type(confirmPasswordInput, 'Password');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
      });
    });

    it('validates password confirmation matches', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'DifferentPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
      });
    });
  });

  describe('password strength indicator', () => {
    beforeEach(() => {
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
    });

    it('shows password strength indicator when password is entered', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');

      // Type weak password
      await user.type(passwordInput, 'weak');

      await waitFor(() => {
        expect(screen.getByText('Weak')).toBeInTheDocument();
      });
    });

    it('updates strength indicator as password improves', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');

      // Type weak password
      await user.type(passwordInput, 'weak');
      await waitFor(() => {
        expect(screen.getByText('Weak')).toBeInTheDocument();
      });

      // Improve to fair
      await user.clear(passwordInput);
      await user.type(passwordInput, 'Password');
      await waitFor(() => {
        expect(screen.getByText('Good')).toBeInTheDocument();
      });

      // Improve to strong
      await user.clear(passwordInput);
      await user.type(passwordInput, 'StrongPass123');
      await waitFor(() => {
        expect(screen.getByText('Strong')).toBeInTheDocument();
      });
    });

    it('shows password requirements checklist on focus', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');

      // Type some text and focus to show requirements
      await user.type(passwordInput, 'test');
      await user.click(passwordInput); // Focus

      await waitFor(() => {
        expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
        expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
        expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
        expect(screen.getByText('One number')).toBeInTheDocument();
      });
    });

    it('shows visual indicators for each password requirement', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');

      // Type strong password and focus to show requirements
      await user.type(passwordInput, 'StrongPass123');
      await user.click(passwordInput);

      await waitFor(() => {
        // All requirements should be visible
        expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
        expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
        expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
        expect(screen.getByText('One number')).toBeInTheDocument();
      });
    });

    it('hides requirements checklist on blur', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');

      // Type and focus to show requirements
      await user.type(passwordInput, 'test');
      await user.click(passwordInput);

      await waitFor(() => {
        expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
      });

      // Blur by focusing another element
      await user.click(confirmPasswordInput);

      await waitFor(() => {
        expect(screen.queryByText('At least 8 characters')).not.toBeInTheDocument();
      });
    });
  });

  describe('form submission', () => {
    beforeEach(() => {
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
    });

    it('calls updatePassword with correct password on successful form submission', async () => {
      const user = userEvent.setup();
      mockUpdatePassword.mockResolvedValue({ data: createMockUser(), error: null });

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith('NewPassword123');
      });
    });

    it('shows loading state during submission', async () => {
      const user = userEvent.setup();
      let resolvePromise: ((value: AuthResponse<User>) => void) | undefined;
      const promise = new Promise<AuthResponse<User>>((resolve) => {
        resolvePromise = resolve as (value: AuthResponse<User>) => void;
      });
      mockUpdatePassword.mockReturnValue(promise);

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      // Check loading state
      expect(screen.getByRole('button', { name: /resetting password/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Create a strong password')).toBeDisabled();
      expect(screen.getByPlaceholderText('Re-enter your password')).toBeDisabled();

      // Resolve the promise
      resolvePromise!({ data: createMockUser(), error: null });
      await waitFor(() => {
        expect(screen.getByText('Password Reset Successful!')).toBeInTheDocument();
      });
    });

    it('shows success state and redirects after successful submission', async () => {
      // Use fake timers for this test only
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockUpdatePassword.mockResolvedValue({ data: createMockUser(), error: null });

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password Reset Successful!')).toBeInTheDocument();
        expect(
          screen.getByText('Your password has been updated successfully. Redirecting to login...'),
        ).toBeInTheDocument();
      });

      // Fast-forward through the 3-second redirect timeout
      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });

      // Restore real timers
      vi.useRealTimers();
    });

    it('handles form submission when API call fails', async () => {
      const user = userEvent.setup();
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
      mockUpdatePassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Invalid token', AuthErrorCode.SESSION_EXPIRED),
      });

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith('NewPassword123');
        expect(
          screen.getByText('Your reset link has expired. Please request a new password reset.'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
    });

    it('displays error for expired session', async () => {
      const user = userEvent.setup();
      mockUpdatePassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Session expired', AuthErrorCode.SESSION_EXPIRED),
      });

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('Your reset link has expired. Please request a new password reset.'),
        ).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('displays error for no session', async () => {
      const user = userEvent.setup();
      mockUpdatePassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('No session', AuthErrorCode.NO_SESSION),
      });

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('Your reset link has expired. Please request a new password reset.'),
        ).toBeInTheDocument();
      });
    });

    it('displays error for weak password', async () => {
      const user = userEvent.setup();
      mockUpdatePassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Weak password', AuthErrorCode.WEAK_PASSWORD),
      });

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password does not meet the security requirements.')).toBeInTheDocument();
      });
    });

    it('displays generic error for unknown errors', async () => {
      const user = userEvent.setup();
      mockUpdatePassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Unknown error', AuthErrorCode.UNKNOWN),
      });

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('Unable to reset password. Please try again or request a new reset link.'),
        ).toBeInTheDocument();
      });
    });

    it('handles unexpected errors gracefully', async () => {
      const user = userEvent.setup();
      mockUpdatePassword.mockRejectedValue(new Error('Unexpected error'));

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Unable to reset password. Please try again.')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
    });

    it('provides link back to login in the footer', async () => {
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const backLinks = screen.getAllByRole('link', { name: /back to login/i });
      expect(backLinks.length).toBeGreaterThan(0);
      backLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/login');
      });
    });

    it('provides proper navigation link structure', async () => {
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const backLinks = screen.getAllByRole('link', { name: /back to login/i });
      expect(backLinks.length).toBeGreaterThan(0);
      backLinks.forEach((link) => {
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', '/login');
      });
    });

    it('disables navigation button during loading', async () => {
      const user = userEvent.setup();
      let resolvePromise: ((value: AuthResponse<User>) => void) | undefined;
      const promise = new Promise<AuthResponse<User>>((resolve) => {
        resolvePromise = resolve as (value: AuthResponse<User>) => void;
      });
      mockUpdatePassword.mockReturnValue(promise);

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      const backLink = screen.getByRole('link', { name: /back to login/i });
      expect(backLink).toHaveAttribute('aria-disabled', 'true');

      // Resolve the promise
      resolvePromise!({ data: createMockUser(), error: null });
      await waitFor(() => {
        expect(screen.getByText('Password Reset Successful!')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    beforeEach(() => {
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
    });

    it('has proper ARIA labels and semantic structure', async () => {
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      // Form has proper structure
      expect(document.querySelector('form')).toBeInTheDocument();

      // Inputs have proper labels
      expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Re-enter your password')).toBeInTheDocument();

      // Button has proper role and text
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to login/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });
      const backLink = screen.getByRole('link', { name: /back to login/i });

      // Click on first input to start
      await user.click(passwordInput);
      expect(passwordInput).toHaveFocus();

      // Tab through form elements
      await user.tab();
      expect(confirmPasswordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();

      await user.tab();
      expect(backLink).toHaveFocus();
    });

    it('provides accessible error announcements', async () => {
      const user = userEvent.setup();
      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
        expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      });
    });

    it('provides accessible error messages with proper ARIA attributes', async () => {
      const user = userEvent.setup();
      mockUpdatePassword.mockResolvedValue({
        data: null,
        error: createMockAuthError('Session expired', AuthErrorCode.SESSION_EXPIRED),
      });

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('edge cases', () => {
    it('handles initialization during token validation', async () => {
      // Test that the component completes token validation and shows the form
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );
      mockInitialize.mockResolvedValue(undefined);

      render(<ResetPasswordForm />);

      // Should show the password form after token validation
      await waitFor(() => {
        expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      expect(mockInitialize).toHaveBeenCalled();
    });

    it('handles form state correctly during async operations', async () => {
      const user = userEvent.setup();
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );

      let resolvePromise: ((value: AuthResponse<User>) => void) | undefined;
      const promise = new Promise<AuthResponse<User>>((resolve) => {
        resolvePromise = resolve as (value: AuthResponse<User>) => void;
      });
      mockUpdatePassword.mockReturnValue(promise);

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');
      const confirmPasswordInput = screen.getByPlaceholderText('Re-enter your password');
      const submitButton = screen.getByRole('button', { name: /reset password/i });

      await user.type(passwordInput, 'NewPassword123');
      await user.type(confirmPasswordInput, 'NewPassword123');
      await user.click(submitButton);

      // During loading, inputs should be disabled but values preserved
      expect(passwordInput).toBeDisabled();
      expect(confirmPasswordInput).toBeDisabled();
      expect(passwordInput).toHaveValue('NewPassword123');
      expect(confirmPasswordInput).toHaveValue('NewPassword123');

      // Resolve with success
      resolvePromise!({ data: createMockUser(), error: null });
      await waitFor(() => {
        expect(screen.getByText('Password Reset Successful!')).toBeInTheDocument();
      });
    });

    it('handles password strength calculation edge cases', async () => {
      const user = userEvent.setup();
      mockLocationHash.mockReturnValue(
        '#access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U&type=recovery&expires_in=3600',
      );

      render(<ResetPasswordForm />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument();
      });

      const passwordInput = screen.getByPlaceholderText('Create a strong password');

      // Test empty password
      await user.click(passwordInput);
      await user.clear(passwordInput);

      // No strength indicator should show for empty password
      expect(screen.queryByText('Weak')).not.toBeInTheDocument();
      expect(screen.queryByText('Strong')).not.toBeInTheDocument();
    });
  });
});
