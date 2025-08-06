/**
 * Unit Tests for SignupForm Component
 *
 * These tests verify the signup form functionality, including:
 * - Form validation (email format, password strength, confirmation matching)
 * - Password strength indicator and requirements checklist
 * - Terms of service agreement requirement
 * - User interactions (form submission, navigation clicks)
 * - Auth store integration (sign up, error handling, loading states)
 * - Accessibility features (ARIA labels, semantic elements)
 *
 * Note: Uses existing test utilities from @/test/factories/auth.ts for consistent mocking
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthErrorCode } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { createMockSupabaseError } from '@/test/factories/auth';

import { SignupForm } from './SignupForm';

// Mock the auth store
vi.mock('@/stores/auth.store');

describe('SignupForm', () => {
  const mockSignUp = vi.fn();
  const mockClearError = vi.fn();
  const mockUseAuthStore = vi.mocked(useAuthStore);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      signUp: mockSignUp,
      clearError: mockClearError,
      loading: { signUp: false },
      error: null,
    });
  });

  it('renders the signup form with all required fields', () => {
    render(<SignupForm />);

    expect(screen.getByText('Create an account')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByLabelText('Agree to terms')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  });

  it('validates all required fields', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
      expect(screen.getByText('You must agree to the terms of service')).toBeInTheDocument();
    });
  });

  it('validates password strength requirements', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    const passwordInput = screen.getByLabelText('Password');
    const emailInput = screen.getByLabelText('Email address');
    const confirmPasswordInput = screen.getByLabelText('Confirm password');
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Fill in valid email
    await user.type(emailInput, 'test@example.com');

    // Type a weak password and try to submit
    await user.type(passwordInput, 'weak');
    await user.type(confirmPasswordInput, 'weak');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    // Clear and type a password without uppercase
    await user.clear(passwordInput);
    await user.clear(confirmPasswordInput);
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must contain at least one uppercase letter')).toBeInTheDocument();
    });

    // Clear and type a password without numbers
    await user.clear(passwordInput);
    await user.clear(confirmPasswordInput);
    await user.type(passwordInput, 'Password');
    await user.type(confirmPasswordInput, 'Password');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
    });
  });

  it('shows password strength indicator', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    const passwordInput = screen.getByLabelText('Password');

    // Type a strong password
    await user.type(passwordInput, 'StrongPass123');

    await waitFor(() => {
      expect(screen.getByText('Strong')).toBeInTheDocument();
    });
  });

  it('validates password confirmation matches', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm password');

    await user.type(passwordInput, 'Password123');
    await user.type(confirmPasswordInput, 'DifferentPassword123');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });
  });

  it('requires terms of service agreement', async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm password');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123');
    await user.type(confirmPasswordInput, 'Password123');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('You must agree to the terms of service')).toBeInTheDocument();
    });
  });

  it('calls signUp with correct credentials on successful form submission', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = vi.fn();

    mockSignUp.mockResolvedValue(undefined);

    render(<SignupForm onSuccess={mockOnSuccess} />);

    const emailInput = screen.getByLabelText('Email address');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm password');
    const termsCheckbox = screen.getByLabelText('Agree to terms');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123');
    await user.type(confirmPasswordInput, 'Password123');
    await user.click(termsCheckbox);

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockClearError).toHaveBeenCalled();
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('displays error message when signup fails', () => {
    const authError = createMockSupabaseError({
      message: 'Email already in use',
    });

    mockUseAuthStore.mockReturnValue({
      signUp: mockSignUp,
      clearError: mockClearError,
      loading: { signUp: false },
      error: {
        message: authError.message,
        code: 'EMAIL_IN_USE' as AuthErrorCode,
      },
    });

    render(<SignupForm />);

    expect(screen.getByText('Email already in use')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
  });

  it('disables form inputs and shows loading state during submission', () => {
    mockUseAuthStore.mockReturnValue({
      signUp: mockSignUp,
      clearError: mockClearError,
      loading: { signUp: true },
      error: null,
    });

    render(<SignupForm />);

    expect(screen.getByLabelText('Email address')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByLabelText('Confirm password')).toBeDisabled();
    expect(screen.getByLabelText('Agree to terms')).toBeDisabled();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
    expect(screen.getByText(/creating account/i)).toBeInTheDocument();
  });

  it('calls onSignInClick when sign in link is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSignInClick = vi.fn();

    render(<SignupForm onSignInClick={mockOnSignInClick} />);

    const signInLink = screen.getByRole('button', { name: /sign in/i });
    await user.click(signInLink);

    expect(mockOnSignInClick).toHaveBeenCalled();
  });

  describe('password strength indicator', () => {
    it('shows password strength indicator when password is entered', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const passwordInput = screen.getByLabelText('Password');

      await user.type(passwordInput, 'weak');

      await waitFor(() => {
        expect(screen.getByText('Weak')).toBeInTheDocument();
      });
    });

    it('shows password requirements checklist on focus', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const passwordInput = screen.getByLabelText('Password');

      // Type some text to show password strength and focus to show requirements
      await user.type(passwordInput, 'test');
      await user.click(passwordInput); // Focus to show requirements

      await waitFor(() => {
        expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
        expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
        expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
        expect(screen.getByText('One number')).toBeInTheDocument();
      });
    });

    it('updates strength indicator as password improves', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const passwordInput = screen.getByLabelText('Password');

      // Type weak password
      await user.type(passwordInput, 'weak');
      await waitFor(() => {
        expect(screen.getByText('Weak')).toBeInTheDocument();
      });

      // Clear and type stronger password
      await user.clear(passwordInput);
      await user.type(passwordInput, 'StrongPass123');

      await waitFor(() => {
        expect(screen.getByText('Strong')).toBeInTheDocument();
      });
    });

    it('shows visual indicators for each password requirement', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const passwordInput = screen.getByLabelText('Password');
      await user.type(passwordInput, 'StrongPass123');
      await user.click(passwordInput); // Focus to show requirements

      await waitFor(() => {
        // All requirements should be met - verify the text exists
        expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
        expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
        expect(screen.getByText('One lowercase letter')).toBeInTheDocument();
        expect(screen.getByText('One number')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('has proper ARIA labels and semantic structure', () => {
      render(<SignupForm />);

      // Form has proper structure (using querySelector since form might not have role attribute)
      expect(document.querySelector('form')).toBeInTheDocument();

      // Inputs have proper labels
      expect(screen.getByLabelText('Email address')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
      expect(screen.getByLabelText('Agree to terms')).toBeInTheDocument();

      // Button has proper role and text
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const termsCheckbox = screen.getByLabelText('Agree to terms');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      // Click on first input to start
      await user.click(emailInput);
      expect(emailInput).toHaveFocus();

      // Tab through form elements
      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(confirmPasswordInput).toHaveFocus();

      await user.tab();
      expect(termsCheckbox).toHaveFocus();

      // Tab to submit button (may need to skip other focusable elements like Terms links)
      await user.tab();
      // Since there are links in the terms section, we may need to tab multiple times
      let attempts = 0;
      while (!submitButton.matches(':focus') && attempts < 5) {
        await user.tab();
        attempts++;
      }
      expect(submitButton).toHaveFocus();
    });

    it('provides accessible error announcements', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      await waitFor(() => {
        // Check that error messages are accessible
        expect(screen.getByText('Email is required')).toBeInTheDocument();
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it.each([
      [AuthErrorCode.INVALID_EMAIL, 'Please enter a valid email address.'],
      [AuthErrorCode.WEAK_PASSWORD, 'Password does not meet the requirements.'],
      [AuthErrorCode.NETWORK_ERROR, 'No internet connection. Please check your network and try again.'],
      [AuthErrorCode.OFFLINE, 'No internet connection. Please check your network and try again.'],
      [AuthErrorCode.RATE_LIMITED, 'Too many sign-up attempts. Please wait a few minutes and try again.'],
    ])('displays correct error message for %s', (errorCode, expectedMessage) => {
      mockUseAuthStore.mockReturnValue({
        signUp: mockSignUp,
        clearError: mockClearError,
        loading: { signUp: false },
        error: {
          message: 'Test error',
          code: errorCode,
        },
      });

      render(<SignupForm />);

      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('displays generic error message for unknown error codes', () => {
      mockUseAuthStore.mockReturnValue({
        signUp: mockSignUp,
        clearError: mockClearError,
        loading: { signUp: false },
        error: {
          message: 'Unknown error',
          code: 'UNKNOWN_ERROR' as AuthErrorCode,
        },
      });

      render(<SignupForm />);

      expect(screen.getByText('Unknown error')).toBeInTheDocument();
    });

    it('clears errors when form is submitted', async () => {
      const user = userEvent.setup();
      mockSignUp.mockResolvedValue(undefined);

      render(<SignupForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const termsCheckbox = screen.getByLabelText('Agree to terms');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      await user.click(termsCheckbox);
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

      mockSignUp.mockRejectedValue(new Error('Network error'));

      render(<SignupForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const termsCheckbox = screen.getByLabelText('Agree to terms');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      await user.click(termsCheckbox);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    it('validates complex password requirements', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(emailInput, 'test@example.com');

      // Test password without number
      await user.type(passwordInput, 'Password');
      await user.type(confirmPasswordInput, 'Password');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
      });

      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('prevents submission without terms agreement even if other fields are valid', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const emailInput = screen.getByLabelText('Email address');
      const passwordInput = screen.getByLabelText('Password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      const submitButton = screen.getByRole('button', { name: /create account/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'Password123');
      await user.type(confirmPasswordInput, 'Password123');
      // Don't check terms checkbox
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('You must agree to the terms of service')).toBeInTheDocument();
      });

      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('disables navigation button during loading', () => {
      mockUseAuthStore.mockReturnValue({
        signUp: mockSignUp,
        clearError: mockClearError,
        loading: { signUp: true },
        error: null,
      });

      const mockOnSignInClick = vi.fn();

      render(<SignupForm onSignInClick={mockOnSignInClick} />);

      expect(screen.getByText(/sign in/i)).toBeDisabled();
    });

    it('handles password strength calculation edge cases', async () => {
      const user = userEvent.setup();
      render(<SignupForm />);

      const passwordInput = screen.getByLabelText('Password');

      // Test empty password
      await user.click(passwordInput);
      await user.clear(passwordInput);

      // No strength indicator should show for empty password
      expect(screen.queryByText('Weak')).not.toBeInTheDocument();
      expect(screen.queryByText('Strong')).not.toBeInTheDocument();
    });
  });
});
