import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthLayout, SignupForm } from '@/features/auth';
import { safeDecodeUrl } from '@/lib/security';
import { useIsAuthenticated } from '@/stores/auth.store';

/**
 * Sign-up page that combines the AuthLayout with the SignupForm
 * Handles registration flow and redirects after successful signup
 *
 * Security features:
 * - Validates and sanitizes redirect URLs to prevent open redirect attacks
 * - Safely decodes URL parameters to prevent XSS attacks
 * - Preserves safe redirect destinations across auth flows
 */
export const SignupPage = () => {
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
      // The redirectTo URL has already been validated and is safe
      void navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, redirectTo, navigate]);

  const handleSuccess = () => {
    // Navigation will happen via useEffect when isAuthenticated changes
    // Note: If email confirmation is required, user won't be authenticated immediately
  };

  const handleSignInClick = () => {
    // Preserve the redirect destination when navigating to login
    // Pass the encoded parameter as-is to maintain security validation
    const loginUrl = from ? `/login?from=${from}` : '/login';
    void navigate(loginUrl);
  };

  return (
    <AuthLayout>
      <SignupForm onSuccess={handleSuccess} onSignInClick={handleSignInClick} />
    </AuthLayout>
  );
};
