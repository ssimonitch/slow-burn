import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { safeEncodeUrl } from '@/lib/security';
import { useAuthInitialized, useIsAuthenticated } from '@/stores/auth.store';

/**
 * ProtectedRoute component for handling authenticated routes
 *
 * This component checks authentication status and redirects to login
 * if the user is not authenticated. It preserves the intended destination
 * so users can be redirected back after successful login.
 *
 * Features:
 * - Authentication check using Zustand auth store
 * - Secure URL validation to prevent open redirect attacks
 * - Preserves intended destination in URL params
 * - Shows loading state during auth initialization
 * - Renders child routes via Outlet when authenticated
 */
export function ProtectedRoute() {
  const location = useLocation();
  // Use dedicated selector hooks for better performance and to avoid infinite loops
  const isAuthenticated = useIsAuthenticated();
  const initialized = useAuthInitialized();

  // Show loading state while auth is initializing
  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div
            className="border-primary mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            role="progressbar"
            aria-label="Loading your fitness journey"
          />
          <h2 className="text-lg font-semibold">Slow Burn</h2>
          <p className="text-muted-foreground text-sm">Loading your fitness journey...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Securely preserve the current location for post-login redirect
    // This prevents open redirect attacks by validating the URL
    const currentPath = location.pathname + location.search;
    const redirectTo = safeEncodeUrl(currentPath);

    // Only include the 'from' parameter if we have a valid redirect URL
    const loginUrl = redirectTo ? `/login?from=${redirectTo}` : '/login';
    return <Navigate to={loginUrl} replace />;
  }

  // Render child routes
  return <Outlet />;
}
