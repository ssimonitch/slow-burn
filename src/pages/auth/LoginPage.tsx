import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthLayout, LoginForm } from '@/features/auth';
import { logError } from '@/lib/logger';
import { safeDecodeUrl } from '@/lib/security';
import { useIsAuthenticated } from '@/stores/auth.store';

/**
 * Login page that combines the AuthLayout with the LoginForm
 * Handles authentication flow and redirects after successful login
 *
 * Security features:
 * - Validates and sanitizes redirect URLs to prevent open redirect attacks
 * - Safely decodes URL parameters to prevent XSS attacks
 * - Preserves safe redirect destinations across auth flows
 */
export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useIsAuthenticated();

  // Securely get redirect destination from URL params
  // This prevents open redirect and XSS attacks by validating the URL
  const from = searchParams.get('from');
  const redirectTo = safeDecodeUrl(from, '/dashboard');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      try {
        // The redirectTo URL has already been validated and is safe
        void navigate(redirectTo, { replace: true });
      } catch (error) {
        // Navigation failed, but component remains functional
        logError('Navigation failed', error, { from: 'LoginPage', redirectTo });
      }
    }
  }, [isAuthenticated, redirectTo, navigate]);

  const handleSuccess = () => {
    // Navigation will happen via useEffect when isAuthenticated changes
    // This ensures consistent behavior with the auth state
  };

  return (
    <AuthLayout>
      <LoginForm onSuccess={handleSuccess} redirectUrl={from ?? undefined} />
    </AuthLayout>
  );
};
