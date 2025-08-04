# Routing Architecture

This document describes the routing architecture implemented in the Slow Burn frontend application using React Router v7.

## Overview

The application uses React Router DOM v7 for client-side routing with a clear separation between public and protected routes. All routing is configured in `src/App.tsx` with security-first principles.

## Route Structure

```
/                    (redirects to /login or /dashboard)
├── /login          Public - Login page
├── /signup         Public - Sign up page
├── /dashboard      Protected - Main dashboard
├── /workouts       Protected - Workout management (future)
├── /plans          Protected - Workout plans (future)
├── /exercises      Protected - Exercise library (future)
└── /profile        Protected - User profile (future)
```

## Core Components

### App.tsx - Route Configuration

The main routing configuration uses React Router's declarative API:

```typescript
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

function App() {
  const { initialize } = useAuthStore();
  
  useEffect(() => {
    initialize(); // Set up auth state listener
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Future protected routes */}
        </Route>
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### ProtectedRoute Component

The `ProtectedRoute` component wraps all authenticated routes:

```typescript
export function ProtectedRoute() {
  const isAuthenticated = useIsAuthenticated();
  const initialized = useAuthInitialized();
  const location = useLocation();

  // Show loading during auth initialization
  if (!initialized) {
    return <LoadingScreen />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    const returnUrl = location.pathname + location.search;
    const encodedReturnUrl = safeEncodeUrl(returnUrl);
    return <Navigate to={`/login?returnUrl=${encodedReturnUrl}`} replace />;
  }

  // Render protected content
  return <Outlet />;
}
```

## Navigation Patterns

### Programmatic Navigation

Use the `useNavigate` hook for programmatic navigation:

```typescript
import { useNavigate } from 'react-router-dom';

function Component() {
  const navigate = useNavigate();
  
  const handleSuccess = () => {
    navigate('/dashboard');
  };
  
  const handleRedirect = (url: string) => {
    // Always validate URLs before navigation
    const safeUrl = validateReturnUrl(url);
    navigate(safeUrl);
  };
}
```

### Link Components

Use React Router's `Link` component for declarative navigation:

```typescript
import { Link } from 'react-router-dom';

<Link to="/dashboard" className="...">
  Go to Dashboard
</Link>

// For external links, use standard anchor tags
<a href="https://external.com" target="_blank" rel="noopener noreferrer">
  External Link
</a>
```

## Authentication Flow

### Login with Return URL

The login flow preserves the user's intended destination:

1. User attempts to access protected route
2. `ProtectedRoute` redirects to `/login?returnUrl=/intended/path`
3. Login form preserves the return URL
4. After successful login, user is redirected to intended path
5. Return URL is validated to prevent open redirects

```typescript
// In LoginForm component
const [searchParams] = useSearchParams();
const navigate = useNavigate();

const handleLoginSuccess = () => {
  const returnUrl = searchParams.get('returnUrl');
  const validatedUrl = validateReturnUrl(safeDecodeUrl(returnUrl));
  navigate(validatedUrl);
};
```

### Logout Flow

The logout process cleans up all auth state:

```typescript
const handleSignOut = async () => {
  await signOut(); // Clears Supabase session
  navigate('/login'); // Redirect to login
};
```

## Loading States

### During Authentication Check

The `ProtectedRoute` component shows a loading state while verifying authentication:

```typescript
if (!initialized) {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <Loader className="mx-auto h-12 w-12 animate-spin" />
        <h2>Slow Burn</h2>
        <p>Loading your fitness journey...</p>
      </div>
    </div>
  );
}
```

### Page Transitions

For smooth transitions between routes, consider using React Suspense:

```typescript
import { Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));

<Suspense fallback={<LoadingScreen />}>
  <Dashboard />
</Suspense>
```

## Error Boundaries

Implement error boundaries for route-level error handling:

```typescript
class RouteErrorBoundary extends Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    errorReporter.reportError(
      'Route rendering failed',
      ErrorCategory.UNKNOWN,
      ErrorSeverity.HIGH,
      error
    );
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorPage />;
    }
    return this.props.children;
  }
}
```

## Security Considerations

### URL Validation

All navigation URLs must be validated:

```typescript
// ❌ Bad - Direct navigation without validation
navigate(userProvidedUrl);

// ✅ Good - Validated navigation
const safeUrl = validateReturnUrl(userProvidedUrl);
navigate(safeUrl);
```

### Protected Route Security

The `ProtectedRoute` component implements multiple security layers:

1. **Authentication Check**: Verifies valid session exists
2. **Loading State**: Prevents information leakage during verification
3. **URL Encoding**: Safely encodes return URLs to prevent injection
4. **Redirect Validation**: Validates all redirect URLs

### Query Parameter Handling

Always validate and sanitize query parameters:

```typescript
const [searchParams] = useSearchParams();

// Validate string parameters
const tab = searchParams.get('tab');
const validTab = ['overview', 'history', 'settings'].includes(tab) ? tab : 'overview';

// Parse numeric parameters safely
const page = Number(searchParams.get('page')) || 1;
const validPage = page > 0 ? page : 1;
```

## Testing Routes

### Testing Protected Routes

```typescript
describe('ProtectedRoute', () => {
  it('should redirect to login when not authenticated', () => {
    vi.mocked(useIsAuthenticated).mockReturnValue(false);
    vi.mocked(useAuthInitialized).mockReturnValue(true);
    
    render(<ProtectedRoute />, {
      routerOptions: {
        initialEntries: ['/dashboard'],
      },
    });
    
    // Verify redirect behavior
  });
  
  it('should render outlet when authenticated', () => {
    vi.mocked(useIsAuthenticated).mockReturnValue(true);
    vi.mocked(useAuthInitialized).mockReturnValue(true);
    
    render(<ProtectedRoute />);
    
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });
});
```

### Testing Navigation

```typescript
describe('Navigation', () => {
  it('should navigate to dashboard after login', async () => {
    const user = userEvent.setup();
    
    render(<LoginForm />, {
      routerOptions: {
        initialEntries: ['/login?returnUrl=%2Fdashboard'],
      },
    });
    
    // Fill form and submit
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    
    // Verify navigation occurred
  });
});
```

## Performance Optimization

### Code Splitting

Implement route-based code splitting for better performance:

```typescript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Workouts = lazy(() => import('./pages/Workouts'));
const Profile = lazy(() => import('./pages/Profile'));
```

### Prefetching

Consider prefetching routes that users are likely to navigate to:

```typescript
// Prefetch on hover
<Link 
  to="/workouts"
  onMouseEnter={() => {
    import('./pages/Workouts'); // Prefetch module
  }}
>
  Workouts
</Link>
```

## Future Enhancements

### Planned Routes

- `/workouts/:id` - Individual workout details
- `/plans/:id` - Workout plan details
- `/exercises/:id` - Exercise details with videos
- `/chat` - AI companion chat interface
- `/settings` - User preferences and settings

### Advanced Features

- **Nested Routes**: For complex layouts with shared UI
- **Route Guards**: Additional permission checks for admin features
- **Breadcrumbs**: Navigation context for deep routes
- **Route Transitions**: Smooth animations between pages
- **Deep Linking**: Support for mobile app deep links

## Best Practices

1. **Always validate URLs** before navigation
2. **Use typed route parameters** with TypeScript
3. **Implement loading states** for async route guards
4. **Handle errors gracefully** with error boundaries
5. **Test all navigation flows** including edge cases
6. **Document route requirements** in components
7. **Keep routes flat** when possible for simplicity
8. **Use consistent naming** for route paths
9. **Implement 404 handling** for unknown routes
10. **Monitor route performance** with analytics

## Debugging Routes

### React Router DevTools

Use React Router DevTools for debugging:

```typescript
if (import.meta.env.DEV) {
  // Enable route debugging
  window.__REACT_ROUTER_DEVTOOLS__ = true;
}
```

### Logging Navigation

Add navigation logging in development:

```typescript
if (import.meta.env.DEV) {
  window.addEventListener('popstate', () => {
    console.log('Navigation:', window.location.pathname);
  });
}
```

## Migration Notes

When adding new routes:

1. Determine if route should be protected
2. Add route to appropriate section in App.tsx
3. Implement loading and error states
4. Add security validation if handling parameters
5. Write tests for navigation flows
6. Update this documentation

Remember: **All routes handling user data must be protected and validate all inputs**.