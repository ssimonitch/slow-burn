import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/sonner';
import { isDevelopment } from '@/config/env';
import { ThemeProvider } from '@/features/theme/ThemeProvider';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { setupGlobalErrorHandlers } from '@/lib/logger';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from '@/pages/auth';
import { Dashboard } from '@/pages/Dashboard';
import { Home } from '@/pages/Home';
import { PlansPage } from '@/pages/plans';
import { queryClient } from '@/services/query/client';
import { useAuthInit } from '@/stores';

// Network monitoring component
function NetworkMonitor() {
  useNetworkStatus();
  return null;
}

// Create the router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    // Protected routes
    element: <ProtectedRoute />,
    children: [
      {
        path: '/dashboard',
        element: <Dashboard />,
      },
      {
        path: '/plans',
        element: <PlansPage />,
      },
      // Future protected routes will be added here:
      // { path: '/workouts', element: <WorkoutsPage /> },
      // { path: '/profile', element: <ProfilePage /> },
    ],
  },
  {
    // Catch-all redirect to home
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

function App() {
  // Initialize auth store on app mount
  const { initialized: authInitialized, cleanup } = useAuthInit();

  // Set up global error handlers on mount
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  // Cleanup auth listeners on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Show loading state while auth is initializing
  if (!authInitialized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
          <h2 className="text-lg font-semibold">Slow Burn</h2>
          <p className="text-muted-foreground text-sm">Loading your fitness journey...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
          <NetworkMonitor />
          <RouterProvider router={router} />
          <Toaster position="bottom-right" richColors closeButton />
        </ThemeProvider>
        {isDevelopment() && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
