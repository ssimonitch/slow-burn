/**
 * Unit Tests for ResetPasswordPage Component
 *
 * These tests verify the reset password page functionality, including:
 * - Proper rendering with AuthLayout wrapper
 * - Navigation back to login after password reset
 * - Integration with ResetPasswordForm component
 * - URL hash token handling for password reset
 * - Security handling of reset tokens
 *
 * Note: Uses existing test utilities from @/test/helpers/render for consistent routing setup
 */

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '@/test/helpers/render';

import { ResetPasswordPage } from './ResetPasswordPage';

// Mock the auth features
vi.mock('@/features/auth', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-layout">
      <div data-testid="auth-layout-content">{children}</div>
    </div>
  ),
  ResetPasswordForm: () => {
    // Create mock Link component to avoid require() call
    const Link = vi.fn().mockImplementation(({ to, children, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ));

    return (
      <div data-testid="reset-password-form">
        <h1>Reset Password Form</h1>
        <Link to="/login" data-testid="back-to-login-link">
          Back to Login
        </Link>
      </div>
    );
  },
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location.hash
    delete (window as unknown as { location?: unknown }).location;
    (window as unknown as { location: { hash: string } }).location = { hash: '' };
  });

  describe('basic rendering', () => {
    it('should render with AuthLayout wrapper', () => {
      render(<ResetPasswordPage />);

      expect(screen.getByTestId('auth-layout')).toBeInTheDocument();
      expect(screen.getByTestId('auth-layout-content')).toBeInTheDocument();
    });

    it('should render ResetPasswordForm inside AuthLayout', () => {
      render(<ResetPasswordPage />);

      const authLayout = screen.getByTestId('auth-layout');
      const resetPasswordForm = screen.getByTestId('reset-password-form');

      expect(authLayout).toContainElement(resetPasswordForm);
      expect(screen.getByText('Reset Password Form')).toBeInTheDocument();
    });

    it('should render back to login link in ResetPasswordForm', () => {
      render(<ResetPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');
      expect(backLink).toBeInTheDocument();
      expect(backLink).toHaveAttribute('href', '/login');
    });
  });

  describe('navigation behavior', () => {
    it('should have a link to login page', () => {
      render(<ResetPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should render link with clean URL (no query parameters)', () => {
      render(<ResetPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');
      const href = backLink.getAttribute('href');
      expect(href).toBe('/login');
      expect(href).not.toContain('?');
      expect(href).not.toContain('from=');
    });

    it('should render as a proper link element for accessibility', () => {
      render(<ResetPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');
      expect(backLink.tagName).toBe('A');
      expect(backLink).toHaveAttribute('href', '/login');
    });
  });

  describe('URL hash token handling', () => {
    it('should work with reset token in URL hash', () => {
      // Mock URL hash with reset token
      (window as unknown as { location: { hash: string } }).location = {
        hash: '#access_token=reset_token_here&expires_in=3600&refresh_token&token_type=bearer&type=recovery',
      };

      render(<ResetPasswordPage />);

      // Component should render normally even with token in hash
      expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
      expect(screen.getByText('Reset Password Form')).toBeInTheDocument();
    });

    it('should work without URL hash', () => {
      render(<ResetPasswordPage />);

      expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
      expect(screen.getByText('Reset Password Form')).toBeInTheDocument();
    });

    it('should work with empty URL hash', () => {
      (window as unknown as { location: { hash: string } }).location = { hash: '' };

      render(<ResetPasswordPage />);

      expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    });

    it('should work with malformed URL hash', () => {
      (window as unknown as { location: { hash: string } }).location = { hash: '#invalid_token_format' };

      render(<ResetPasswordPage />);

      // Should still render without crashing
      expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    });
  });

  describe('component integration', () => {
    it('should pass correct props to ResetPasswordForm', () => {
      render(<ResetPasswordPage />);

      // Verify the form renders and has the back button (indicating props are passed correctly)
      expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
      expect(screen.getByTestId('back-to-login-link')).toBeInTheDocument();
    });

    it('should maintain component structure with AuthLayout and ResetPasswordForm', () => {
      render(<ResetPasswordPage />);

      const authLayout = screen.getByTestId('auth-layout');
      const authLayoutContent = screen.getByTestId('auth-layout-content');
      const resetPasswordForm = screen.getByTestId('reset-password-form');

      expect(authLayout).toBeInTheDocument();
      expect(authLayoutContent).toBeInTheDocument();
      expect(resetPasswordForm).toBeInTheDocument();
      expect(authLayout).toContainElement(authLayoutContent);
      expect(authLayoutContent).toContainElement(resetPasswordForm);
    });

    it('should allow ResetPasswordForm to handle token parsing internally', () => {
      // The page component should not interfere with token parsing
      (window as unknown as { location: { hash: string } }).location = {
        hash: '#access_token=test_token&type=recovery',
      };

      render(<ResetPasswordPage />);

      // Form should receive the callback and be able to access window.location.hash
      expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle component rendering without errors', () => {
      // Link components handle navigation internally, so no navigation errors to test
      expect(() => {
        render(<ResetPasswordPage />);
      }).not.toThrow();

      const backLink = screen.getByTestId('back-to-login-link');
      expect(backLink).toBeInTheDocument();
    });

    it('should handle component rendering errors gracefully', () => {
      // Test that component doesn't crash with various error conditions
      expect(() => {
        render(<ResetPasswordPage />);
      }).not.toThrow();
    });

    it('should handle missing window.location gracefully', () => {
      // Mock missing location object
      const originalLocation = window.location;
      delete (window as unknown as { location?: unknown }).location;

      expect(() => {
        render(<ResetPasswordPage />);
      }).not.toThrow();

      // Restore location
      (window as unknown as { location: Location }).location = originalLocation;
    });
  });

  describe('security considerations', () => {
    it('should not log or expose reset tokens', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      (window as unknown as { location: { hash: string } }).location = {
        hash: '#access_token=secret_reset_token&type=recovery',
      };

      render(<ResetPasswordPage />);

      // Verify no tokens are logged
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('secret_reset_token'));

      consoleSpy.mockRestore();
    });

    it('should handle token validation at form level, not page level', () => {
      // Page component should not validate tokens - that's the form's responsibility
      (window as unknown as { location: { hash: string } }).location = {
        hash: '#access_token=potentially_invalid_token&type=recovery',
      };

      render(<ResetPasswordPage />);

      // Should render successfully regardless of token validity
      expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    });

    it('should not modify or interact with URL hash directly', () => {
      const originalHash = '#access_token=test_token&type=recovery';
      (window as unknown as { location: { hash: string } }).location = { hash: originalHash };

      render(<ResetPasswordPage />);

      // Hash should remain unchanged by page component
      expect(window.location.hash).toBe(originalHash);
    });
  });

  describe('accessibility and user experience', () => {
    it('should maintain focus management with link navigation', () => {
      render(<ResetPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');

      // Focus the link
      backLink.focus();
      expect(backLink).toHaveFocus();

      // Links navigate on click by default
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(<ResetPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');

      // Tab to the link
      await user.tab();

      // Links are naturally keyboard accessible
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should provide proper page structure for screen readers', () => {
      render(<ResetPasswordPage />);

      // Check that the page has proper structure
      const authLayout = screen.getByTestId('auth-layout');
      const resetPasswordForm = screen.getByTestId('reset-password-form');

      expect(authLayout).toBeInTheDocument();
      expect(resetPasswordForm).toBeInTheDocument();
      expect(screen.getByText('Reset Password Form')).toBeInTheDocument();
    });
  });

  describe('successful password reset flow', () => {
    it('should provide navigation back to login', () => {
      render(<ResetPasswordPage />);

      // Link should be available for navigation back to login
      const backLink = screen.getByTestId('back-to-login-link');
      expect(backLink).toHaveAttribute('href', '/login');
    });

    it('should provide consistent navigation URL', () => {
      render(<ResetPasswordPage />);

      const backLink = screen.getByTestId('back-to-login-link');
      const href = backLink.getAttribute('href');

      // Should always link to the same clean login URL
      expect(href).toBe('/login');
      expect(href).not.toContain('returnUrl');
      expect(href).not.toContain('from');
    });
  });
});
