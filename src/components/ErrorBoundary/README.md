# Unified ErrorBoundary Component

## Overview

This is a unified, composable error boundary component that consolidates error handling across the Slow Burn application. It replaces the previous duplicate implementations (`ErrorBoundary.tsx` and `AuthErrorBoundary.tsx`) with a single, flexible solution.

## Features

### ✅ Composable Error Handlers

- **Modular handler system** - Each error type has its own handler
- **Priority-based selection** - Handlers are checked in priority order
- **Easy to extend** - Simply add new handlers for new error types

### ✅ Consistent UI

- **100% shadcn/ui components** - No raw HTML, consistent design system
- **Card-based layout** - Clean, professional error display
- **Responsive design** - Works on all screen sizes

### ✅ Fitness-Optimized UX

- **56px minimum touch targets** - Easy to tap with sweaty hands or gloves
- **High contrast colors** - Readable in bright gym lighting
- **Large text** - Easy to read during workouts
- **Simple recovery options** - Single-tap actions to recover

### ✅ Smart Error Detection

- **Authentication errors** - Session expiration, invalid credentials
- **Network errors** - Offline detection, timeout handling
- **Generic errors** - Fallback for any unexpected errors

### ✅ Development Support

- **Error details in dev mode** - Full stack traces for debugging
- **Production-safe** - No sensitive information exposed in production
- **Comprehensive logging** - All errors logged to centralized system

## Usage

### Basic Usage

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <YourApp />
    </ErrorBoundary>
  );
}
```

### With Custom Handlers

```tsx
import { ErrorBoundaryWrapper } from '@/components/ErrorBoundary';
import { authErrorHandler } from '@/lib/errorHandlers';

function AuthenticatedSection() {
  return (
    <ErrorBoundaryWrapper handlers={[authErrorHandler]}>
      <ProtectedContent />
    </ErrorBoundaryWrapper>
  );
}
```

### With Custom Fallback

```tsx
<ErrorBoundary fallback={<CustomErrorUI />}>
  <YourComponent />
</ErrorBoundary>
```

## Handler System

### Built-in Handlers

1. **AuthErrorHandler** (Priority: 10)
   - Handles authentication and session errors
   - Shows "Sign In Again" and "Sign Out" actions
   - Automatically shows auth-specific toasts

2. **NetworkErrorHandler** (Priority: 5)
   - Handles offline and network errors
   - Shows "Try Again" and "Refresh Page" actions
   - Detects offline status and connection issues

3. **DefaultErrorHandler** (Priority: 0)
   - Fallback for all other errors
   - Shows "Try Again" and "Go Home" actions
   - Provides generic error messaging

### Creating Custom Handlers

```typescript
import type { ErrorHandler } from '@/lib/errorHandlers';

export const customHandler: ErrorHandler = {
  priority: 15, // Higher priority = checked first

  canHandle: (error: Error) => {
    // Return true if this handler can handle the error
    return error.message.includes('custom');
  },

  getTitle: (error: Error) => 'Custom Error',

  getDescription: (error: Error) => 'A custom error occurred',

  getActions: (error, reset, navigate) => (
    <>
      <Button onClick={reset}>Retry</Button>
      <Button onClick={() => navigate?.('/help')}>Get Help</Button>
    </>
  ),

  onCatch: (error, errorInfo) => {
    // Optional: Custom logging or side effects
    console.log('Custom error caught', error);
  },

  getIcon: () => <CustomIcon />  // Optional custom icon
};
```

## Migration from Old Components

### Before (Two separate components)

```tsx
// 337 lines of duplicated code
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthErrorBoundary } from '@/features/auth/components/AuthErrorBoundary';
```

### After (Single unified component)

```tsx
// ~200 lines with better functionality
import { ErrorBoundary } from '@/components/ErrorBoundary';
```

## Benefits

1. **Reduced Code** - From 337 lines to ~200 lines
2. **Single Source of Truth** - One component for all error boundaries
3. **Consistent UI** - All errors use the same design system
4. **Better UX** - Fitness-optimized touch targets and visibility
5. **Easier Maintenance** - Add new error types without modifying core component
6. **Type Safety** - Full TypeScript support throughout

## Testing

Comprehensive test coverage including:

- Error catching and display
- Handler selection logic
- Recovery mechanisms
- Development vs production behavior
- Fitness UI requirements (touch targets, contrast)
- Router integration

Run tests with:

```bash
pnpm test src/components/ErrorBoundary/ErrorBoundary.test.tsx
```

## Future Enhancements

- [ ] Workout data preservation on error
- [ ] Offline error queue for sync when online
- [ ] Error analytics and reporting
- [ ] Progressive error recovery strategies
- [ ] Haptic feedback integration for mobile
