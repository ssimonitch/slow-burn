# Test Best Practices and Standards

This document defines the testing standards and patterns for the Slow Burn frontend codebase. All test files must adhere to these guidelines to ensure consistency, maintainability, and type safety.

## Core Principles

### 1. Zero Tolerance for Ignore Comments
**NEVER use the following in test files:**
- `@ts-ignore`
- `@ts-expect-error`
- `@ts-nocheck`
- `eslint-disable` (without explicit justification)

If you encounter type issues, you MUST:
1. Create proper typed mock helpers
2. Use proper TypeScript patterns
3. Research solutions using latest documentation
4. Ask for guidance if no clean solution exists

### 2. Type Safety is Mandatory
All test code must be fully typed:
- Test data must have proper interfaces
- Mock functions must be typed
- Assertions must maintain type safety
- No use of `any` without proper type guards

### 3. Follow DRY Principle - Don't Repeat Yourself
**ALWAYS check for existing test utilities before creating new ones:**

#### Test Directory Structure
```
src/test/
├── setup.ts                 # Global test setup
├── factories/               # Mock data creation functions
│   ├── auth.ts             # createMockUser, createMockSession, etc.
├── fixtures/               # Static test data files
├── helpers/                # Test utility functions
└── matchers/               # Custom Vitest matchers (if needed)
```

#### Where to Look for Utilities
- **Mock data factories**: Check `@/test/factories/`
- **Static test data**: Check `@/test/fixtures/`
- **Test helpers**: Check `@/test/helpers/`
- **Custom matchers**: Check `@/test/matchers/`

#### Before Creating New Utilities
1. Search the codebase: `grep -r "createMock\|create[A-Z]" src/test/`
2. Check the appropriate directory for similar helpers
3. Extend existing helpers rather than creating new ones
4. If you must create new helpers:
   - **Factories**: Add to `@/test/factories/[domain].ts`
   - **Helpers**: Add to `@/test/helpers/[functionality].ts`
   - **Fixtures**: Add to `@/test/fixtures/[data-type].json`

## Avoiding Overengineering

### Focus on Value-Adding Tests

**DO NOT write tests for:**
- Simple getters/setters with no logic
- Trivial utility functions that just pass through values
- Framework functionality (React, Vitest, etc.)
- Third-party library behavior
- Implementation details that don't affect behavior

**FOCUS your testing on:**
- Business logic and calculations
- User interactions and workflows
- Error handling and edge cases that could break the app
- Data transformations and validations
- Integration points between modules

### The 80/20 Rule for Testing

Aim for 80% coverage with 20% effort:
1. Test the critical paths first
2. Test what's likely to break
3. Test what would be expensive to fix in production
4. Skip exhaustive permutations unless they add real value

### Examples of Overengineered Tests to AVOID:

```typescript
// ❌ BAD - Testing every possible combination without value
describe('formatWeight', () => {
  it('formats 0 kg', () => { expect(formatWeight(0)).toBe('0 kg') })
  it('formats 1 kg', () => { expect(formatWeight(1)).toBe('1 kg') })
  it('formats 2 kg', () => { expect(formatWeight(2)).toBe('2 kg') })
  // ... 50 more similar tests
  it('formats 100 kg', () => { expect(formatWeight(100)).toBe('100 kg') })
})

// ✅ GOOD - Test meaningful boundaries and examples
describe('formatWeight', () => {
  it.each([
    [0, '0 kg'],
    [50.5, '50.5 kg'],
    [100, '100 kg'],
    [-1, '0 kg'], // Edge case: negative
    [null, '0 kg'], // Edge case: null
  ])('formats %d as %s', (input, expected) => {
    expect(formatWeight(input)).toBe(expected)
  })
})
```

```typescript
// ❌ BAD - Testing implementation details
it('should call setState 3 times during initialization', () => {
  const setStateSpy = vi.spyOn(store, 'setState')
  store.initialize()
  expect(setStateSpy).toHaveBeenCalledTimes(3) // Brittle, breaks if implementation changes
})

// ✅ GOOD - Test the outcome, not the implementation
it('should initialize with correct state', () => {
  store.initialize()
  expect(store.getState()).toEqual({
    user: null,
    isAuthenticated: false,
    loading: false,
  })
})
```

### Keep Tests Simple and Maintainable

1. **One concept per test** - Don't test multiple behaviors in a single test
2. **Clear test names** - Should explain what and why without reading the code
3. **Minimal setup** - Only set up what's needed for that specific test
4. **Avoid complex test logic** - If your test needs conditionals or loops, it's too complex

## Test File Structure

### 1. File Header Documentation

Every test file MUST begin with a comprehensive comment block:

```typescript
/**
 * Unit Tests for [Component/Module Name]
 *
 * These tests verify [specific functionality], including:
 * - [Key test scenario 1]
 * - [Key test scenario 2]
 * - [Edge cases and error conditions]
 *
 * Note: [Any important testing considerations or limitations]
 */
```

### 2. Mock Setup

Use `vi.mock` with proper typing:

```typescript
// Mock external dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signIn: vi.fn(),
      signUp: vi.fn(),
      // ... other methods
    },
  },
}));
```

### 3. Test Helper Functions

**IMPORTANT: Always check the test directories for existing helpers before creating new ones!**

Use existing helpers from the organized test structure:

```typescript
// ✅ GOOD - Import existing helpers from correct locations
import { createMockUser, createMockSession } from '@/test/factories/auth';
import { createWorkoutData } from '@/test/factories/workout';
import { render } from '@/test/helpers/render';
import { setupFakeTimers } from '@/test/helpers/timers';
import workoutFixtures from '@/test/fixtures/workouts.json';

// ❌ BAD - Don't recreate helpers that already exist
// function createMockUser() { ... } // This already exists!

// ✅ GOOD - Only create test-specific helpers for unique needs
interface TestScenario {
  input: WorkoutData;
  expected: CalculationResult;
  description: string;
}

// If you need a new helper that would be useful elsewhere:
// 1. Determine the correct directory:
//    - Factory function? → @/test/factories/
//    - Test utility? → @/test/helpers/
//    - Static data? → @/test/fixtures/
// 2. Add to existing file or create new domain-specific file
// 3. Export it for reuse
// 4. Import it in your test file
```

### 4. Test Organization

Use nested `describe` blocks for logical grouping:

```typescript
describe('ComponentName', () => {
  // Shared setup
  const mockUser = createMockUser();
  const mockSession = createMockSession();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      // Test implementation
    });
  });

  describe('user interactions', () => {
    it('should handle click events correctly', async () => {
      // Test implementation
    });
  });

  describe('error handling', () => {
    it('should display error message on failure', async () => {
      // Test implementation
    });
  });
});
```

## Testing Patterns

### 1. Type-Safe Mocking

Always use `vi.mocked()` for type-safe mock access:

```typescript
// ✅ Good - Type-safe
vi.mocked(authService.signIn).mockResolvedValue({
  data: { user: mockUser, session: mockSession },
  error: null,
});

// ❌ Bad - Loses type safety
(authService.signIn as Mock).mockResolvedValue({
  data: { user: mockUser, session: mockSession },
  error: null,
});
```

### 2. Async Testing Patterns

#### React Components and Hooks

Use `act()` for state updates:

```typescript
await act(async () => {
  await result.current.initialize();
});
```

Use `waitFor` for async assertions:

```typescript
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

#### Pure Async Functions

```typescript
it('should handle async operations', async () => {
  const promise = someAsyncFunction();
  
  // If using fake timers
  vi.runAllTimers();
  
  const result = await promise;
  expect(result).toBeDefined();
});
```

### 3. Timer Mocking

When testing time-dependent code:

```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

it('should handle timers correctly', () => {
  const callback = vi.fn();
  setTimeout(callback, 1000);
  
  // Fast-forward time
  vi.advanceTimersByTime(1000);
  
  expect(callback).toHaveBeenCalled();
});
```

### 4. Error Testing

Always test both success and failure paths:

```typescript
describe('error handling', () => {
  it('should handle network errors gracefully', async () => {
    const error = new Error('Network error');
    vi.mocked(apiService.fetchData).mockRejectedValue(error);
    
    const result = await functionUnderTest();
    
    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Network error');
  });
});
```

### 5. Test Data Management

Use the appropriate method for test data:

#### Factory Functions (Dynamic Data)
```typescript
// In @/test/factories/workout.ts
export function createWorkoutData(overrides: Partial<WorkoutData> = {}): WorkoutData {
  return {
    id: 'workout-1',
    sets: [],
    exercises: [],
    duration: 0,
    date: new Date().toISOString(),
    ...overrides,
  };
}

// In test file
import { createWorkoutData } from '@/test/factories/workout';

it('should process workout data', () => {
  const workout = createWorkoutData({ sets: 10 });
  // Use workout in test
});
```

#### Fixtures (Static Data)
```typescript
// For complex, realistic test data
import workoutFixtures from '@/test/fixtures/workouts.json';

it('should handle real workout data', () => {
  const workout = workoutFixtures.sampleWorkouts[0];
  // Use realistic workout data in test
});
```

#### When to Use Each
- **Factories**: When you need to customize data for specific test cases
- **Fixtures**: When you need realistic, complex data that doesn't change
- **Inline data**: Only for simple, test-specific data that won't be reused

## Common Patterns

### 1. Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
it('should calculate total correctly', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];
  
  // Act
  const total = calculateTotal(items);
  
  // Assert
  expect(total).toBe(30);
});
```

### 2. Descriptive Test Names

Write test names that describe behavior:

```typescript
// ✅ Good - Descriptive
it('should display error message when form submission fails due to network error', async () => {});

// ❌ Bad - Vague
it('handles errors', () => {});
```

### 3. Using Shared Test Utilities

**MANDATORY: Check these locations FIRST before creating any mock helpers:**

```typescript
// @/test/factories/auth.ts - Authentication mocks:
export function createMockUser(overrides?: Partial<User>): User;
export function createMockSession(overrides?: Partial<Session>): Session;
export function createMockSupabaseError(overrides?: Partial<AuthError>): AuthError;

// @/test/factories/workout.ts - Workout data factories:
export function createWorkoutData(overrides?: Partial<WorkoutData>): WorkoutData;
export function createExerciseData(overrides?: Partial<Exercise>): Exercise;
export function createSetData(overrides?: Partial<WorkoutSet>): WorkoutSet;
export function createWorkoutPlan(overrides?: Partial<WorkoutPlan>): WorkoutPlan;

// @/test/factories/api.ts - API response factories:
export function createApiResponse<T>(data: T, status?: number): ApiResponse<T>;
export function createApiError(message: string, code: string): ApiResponse<null>;
export function createPaginatedResponse<T>(items: T[], meta?: Partial<PaginationMeta>): PaginatedResponse<T>; // Frontend format
export function createBackendPaginatedResponse<T>(items: T[], options?: BackendPaginationOptions): BackendPaginatedResponse<T>; // Backend format

// @/test/helpers/render.tsx - Custom render with providers:
export function render(ui: ReactElement, options?: CustomRenderOptions);

// @/test/helpers/timers.ts - Timer utilities:
export function setupFakeTimers(): void;
export function advanceTimersAndAwait(ms: number): Promise<void>;
export function testDebounce(fn: Function, delay: number, callback: Function): Promise<void>;

// @/test/fixtures/ - Static test data:
// - workouts.json: Sample workout data
// - exercises.json: Exercise library data
```

**Process for adding new utilities:**
1. Confirm it doesn't exist: `grep -r "functionName" src/test/`
2. Determine the type of utility:
   - Mock data creator? → `@/test/factories/`
   - Test helper function? → `@/test/helpers/`
   - Static test data? → `@/test/fixtures/`
3. Add to appropriate existing file or create new domain file
4. Document with JSDoc comments
5. Export for reuse

## UI Testing (React Testing Library)

### Core Philosophy
Focus on user behavior, not implementation details:

```typescript
// ✅ Good - Tests user behavior
const submitButton = screen.getByRole('button', { name: 'Submit' });
await userEvent.click(submitButton);
expect(screen.getByText('Form submitted')).toBeInTheDocument();

// ❌ Bad - Tests implementation
expect(component.state.isSubmitted).toBe(true);
```

### Query Priority
Use queries in this order:
1. `getByRole` - Most accessible
2. `getByLabelText` - For form elements
3. `getByPlaceholderText` - When no label
4. `getByText` - For non-interactive elements
5. `getByTestId` - Last resort

### User Interactions

```typescript
const user = userEvent.setup();

// Type in input
await user.type(screen.getByLabelText('Email'), 'test@example.com');

// Click button
await user.click(screen.getByRole('button', { name: 'Submit' }));

// Clear input
await user.clear(screen.getByLabelText('Email'));

// Select option
await user.selectOptions(screen.getByRole('combobox'), 'option-value');
```

## Business Logic Testing (Vitest)

### Pure Functions

```typescript
describe('calculateWorkoutProgress', () => {
  it('should return 0 for empty workout', () => {
    const result = calculateWorkoutProgress([]);
    expect(result).toBe(0);
  });
  
  it('should calculate percentage correctly', () => {
    const sets = [
      { completed: true },
      { completed: true },
      { completed: false },
      { completed: false },
    ];
    const result = calculateWorkoutProgress(sets);
    expect(result).toBe(50);
  });
});
```

### State Management

```typescript
describe('workout store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useWorkoutStore.setState({
      workouts: [],
      activeWorkout: null,
    });
  });
  
  it('should add workout to store', () => {
    const { result } = renderHook(() => useWorkoutStore());
    const workout = createWorkoutData();
    
    act(() => {
      result.current.addWorkout(workout);
    });
    
    expect(result.current.workouts).toHaveLength(1);
    expect(result.current.workouts[0]).toEqual(workout);
  });
});
```

## Validation Checklist

Before considering tests complete:

### Code Quality
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] No ESLint errors (`pnpm lint`)
- [ ] All tests pass (`pnpm test`)
- [ ] No `@ts-ignore` or similar comments

### DRY Principle
- [ ] Checked `@/test/factories/` for existing mock data factories
- [ ] Checked `@/test/helpers/` for existing test utilities
- [ ] Checked `@/test/fixtures/` for existing test data
- [ ] No duplicated mock helpers across test files
- [ ] Reused existing test utilities where possible
- [ ] New reusable helpers added to appropriate test directory, not local files

### Avoiding Overengineering
- [ ] Tests focus on behavior, not implementation
- [ ] No excessive test cases that don't add value
- [ ] Following 80/20 rule - maximum value with minimum complexity
- [ ] Each test has a clear purpose and value
- [ ] Test names clearly describe what and why

### Test Structure
- [ ] Comprehensive header comment
- [ ] Proper import organization
- [ ] Both success and error paths tested (where meaningful)
- [ ] Async operations properly handled
- [ ] Follows established patterns

## When to Seek Guidance

Ask for help instead of using ignore comments when:
- Third-party library types are incorrect or missing
- Complex generic types are causing issues
- Circular dependencies prevent proper mocking
- Performance optimizations conflict with type safety

## Red Flags in Test Code

If you find yourself doing any of these, STOP and reconsider:

1. **Writing the same mock helper in multiple files** → Use `@/test/factories/` or `@/test/helpers/`
2. **Testing every possible input combination** → Focus on meaningful boundaries
3. **Tests with complex logic (if/else, loops)** → Simplify or split the test
4. **Mocking everything** → Consider if an integration test would be better
5. **Testing implementation details** → Test behavior instead
6. **Copy-pasting test blocks with minor changes** → Use `it.each()` or extract helpers
7. **Tests that break when refactoring (but behavior unchanged)** → Too coupled to implementation
8. **Using `@ts-ignore` or `any`** → Find the proper type or ask for help

## The Golden Rules

1. **Check for existing utilities before creating new ones**
2. **Test behavior, not implementation**
3. **Write tests that add value, not volume**
4. **Keep tests simple enough that they don't need tests**
5. **If a test is hard to write, the code might need refactoring**

Remember: Good tests are an asset. Bad tests are a liability. Focus on writing fewer, better tests rather than many poor ones.