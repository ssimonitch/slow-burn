# Testing Strategy for Slow Burn Frontend

This document outlines our testing approach for the Slow Burn AI Fitness Companion frontend application.

## Overview

We use a hybrid testing strategy that combines:
- **Unit Tests**: Fast, isolated tests for business logic
- **Integration Tests**: Real tests against actual services (Supabase)
- **Component Tests**: UI component behavior testing (future)
- **E2E Tests**: Full user journey testing (future)

## Test Types

### Unit Tests (`.unit.test.ts`)

Unit tests verify business logic in isolation with mocked dependencies.

**When to write unit tests:**
- Input validation logic
- Data transformation functions
- Error handling and mapping
- Complex calculations
- State management logic

**Example: Auth Service Unit Tests**
```typescript
// auth.service.unit.test.ts
it('should validate email format and return error for invalid email', async () => {
  const result = await authService.signUp({
    email: 'invalid-email',
    password: 'password123',
    confirmPassword: 'password123',
  });

  expect(result.error?.code).toBe(AuthErrorCode.INVALID_EMAIL);
});
```

### Integration Tests (`.integration.test.ts`)

Integration tests verify actual interactions with external services.

**When to write integration tests:**
- Authentication flows
- API interactions
- Database operations
- Third-party service integrations
- Session management

**Example: Auth Service Integration Tests**
```typescript
// auth.service.integration.test.ts
it('should successfully sign up a new user', async () => {
  const result = await authService.signUp({
    email: testEmail,
    password: testPassword,
    confirmPassword: testPassword,
  });

  expect(result.error).toBeNull();
  expect(result.data?.user?.email).toBe(testEmail);
});
```

## Running Tests

### Unit Tests Only
```bash
# Run all unit tests
pnpm test

# Watch mode for development
pnpm test:watch

# Run specific test file
pnpm test auth.service.unit.test
```

### Integration Tests
```bash
# Run integration tests (requires local Supabase)
pnpm test:integration

# Run all tests (unit + integration)
pnpm test:all
```

## Test Infrastructure

### Local Supabase Setup

Integration tests require a local Supabase instance:

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Stop when done
supabase stop
```

### Test Helpers

We provide utilities for common test scenarios:

```typescript
import { 
  createTestUser, 
  cleanupTestUser,
  generateTestEmail,
  mockOfflineState 
} from '@/test/supabase-helpers';

// Create unique test user
const testUser = await createTestUser('feature-test');

// Clean up after test
await cleanupTestUser(testUser.email);
```

## Best Practices

### 1. Test Naming
- Unit tests: Focus on the behavior being tested
- Integration tests: Describe the full flow being tested

### 2. Test Isolation
- Each test should be independent
- Clean up test data after each test
- Use unique identifiers for test data

### 3. Mocking Strategy
- Mock external dependencies in unit tests
- Use real services in integration tests
- Mock only what's necessary

### 4. Error Testing
- Test both success and failure paths
- Verify error codes and messages
- Test edge cases and boundary conditions

### 5. Performance
- Keep unit tests fast (< 100ms)
- Integration tests can be slower but should be < 5s
- Use `test.skip` for expensive tests during development

## Test Organization

```
src/
├── services/
│   ├── auth.service.ts
│   ├── auth.service.unit.test.ts      # Unit tests
│   └── auth.service.integration.test.ts # Integration tests
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx                 # Component tests
└── test/
    ├── setup.ts                        # Test setup
    └── supabase-helpers.ts             # Test utilities
```

## CI/CD Considerations

### Unit Tests in CI
- Run on every push
- Must pass for PR merge
- Should complete in < 2 minutes

### Integration Tests in CI
- Run on PR and before deployment
- Use dedicated test database
- Can take longer (5-10 minutes)

## Future Enhancements

### Component Testing
- Use React Testing Library
- Test user interactions
- Verify accessibility

### E2E Testing
- Use Playwright or Cypress
- Test critical user journeys
- Run before production deployments

### Visual Regression Testing
- Capture UI screenshots
- Compare against baselines
- Catch unexpected UI changes

## Troubleshooting

### Common Issues

1. **Integration tests failing locally**
   - Ensure Supabase is running: `supabase status`
   - Check environment variables are set
   - Verify network connectivity

2. **Test user cleanup failures**
   - Some cleanup requires service role key
   - Manual cleanup may be needed occasionally
   - Check Supabase dashboard for orphaned test users

3. **Flaky tests**
   - Add proper waits for async operations
   - Increase timeouts for slow operations
   - Use retry logic for network requests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supabase Testing Guide](https://supabase.com/docs/guides/testing)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)
- [Testing Best Practices](https://testingjavascript.com/)