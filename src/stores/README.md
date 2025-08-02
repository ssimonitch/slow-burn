# Zustand Stores

This directory contains all Zustand stores for state management in the Slow Burn frontend application.

## Auth Store (`auth.store.ts`)

The auth store manages authentication state and integrates with Supabase auth.

### Features

- **Automatic Sync**: Listens to Supabase auth state changes and updates store accordingly
- **Loading States**: Tracks loading status for each auth operation (init, signIn, signUp, signOut)
- **Error Handling**: Stores typed errors with specific error codes
- **Type Safety**: Full TypeScript support with proper types
- **Performance**: Includes selector hooks to minimize re-renders
- **DevTools Support**: Integrated with Redux DevTools in development

### State Interface

```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: {
    init: boolean;
    signIn: boolean;
    signUp: boolean;
    signOut: boolean;
  };
  error: AuthError | null;
  initialized: boolean;
  _unsubscribe: (() => void) | null; // Internal cleanup function
}
```

### Usage

#### Initialize Auth (in App.tsx)
```typescript
import { useEffect } from 'react';
import { useAuthInit } from '@/stores';

function App() {
  const { initialized: authInitialized, cleanup } = useAuthInit();

  // Cleanup auth listeners on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  if (!authInitialized) {
    return <LoadingScreen />;
  }

  return <YourApp />;
}
```

#### Access Auth State
```typescript
import { useUser, useIsAuthenticated, useAuthLoading } from '@/stores';

function Profile() {
  const user = useUser();
  const isAuthenticated = useIsAuthenticated();
  const { signOut } = useAuthLoading();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return <UserProfile user={user} />;
}
```

#### Perform Auth Actions
```typescript
import { useAuthStore } from '@/stores';

function LoginForm() {
  const { signIn, clearError } = useAuthStore();
  const error = useAuthError();
  const { signIn: isSigningIn } = useAuthLoading();

  const handleSubmit = async (credentials) => {
    try {
      await signIn(credentials);
      // Navigate to dashboard
    } catch (error) {
      // Error is already in store, but can be handled here
    }
  };

  // Clear errors on unmount
  useEffect(() => {
    return () => clearError();
  }, [clearError]);
}
```

### Selector Hooks

Use these hooks for optimal performance:

- `useUser()` - Current user object
- `useSession()` - Current session object
- `useIsAuthenticated()` - Boolean auth status
- `useAuthLoading()` - Loading states object
- `useAuthError()` - Current error object
- `useAuthInitialized()` - Initialization status
- `useAuthInit()` - Initialize auth and return { initialized, cleanup }

### Cleanup

The auth store provides a `cleanup()` action to properly unsubscribe from auth state changes. This should be called when the app unmounts to prevent memory leaks:

```typescript
const { cleanup } = useAuthStore();

// Call cleanup when done
cleanup();
```

### Testing

The auth store includes comprehensive tests covering:
- Initialization with/without existing session
- Sign in/up/out operations
- Auth state change handling
- Error scenarios
- Loading state management
- Cleanup functionality

Run tests with: `pnpm test src/stores/auth.store.test.ts`