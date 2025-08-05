# API Client Usage Guide

This guide demonstrates how to use the API client and React Query hooks in the Slow Burn frontend.

## Basic Usage

### Using Query Hooks in Components

```typescript
import { useExercises, usePlans, useUserProfile } from '@/services/query/hooks';

function MyComponent() {
  // Fetch user profile
  const { data: userProfile, isLoading: profileLoading } = useUserProfile();
  
  // Fetch exercises with filters
  const { data: exercises, isLoading: exercisesLoading } = useExercises({
    category: 'strength',
    equipment: 'barbell',
    limit: 10,
  });
  
  // Fetch plans
  const { data: plans } = usePlans({
    is_public: true,
    difficulty: 'beginner',
  });
  
  if (profileLoading || exercisesLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div>
      <h1>Welcome, {userProfile?.full_name || 'User'}</h1>
      <p>Affinity Score: {userProfile?.affinity_score}</p>
      
      <h2>Exercises ({exercises?.meta.total} total)</h2>
      {exercises?.data.map((exercise) => (
        <div key={exercise.id}>{exercise.name}</div>
      ))}
    </div>
  );
}
```

### Using Mutations

```typescript
import { useCreatePlan, useUpdatePlan, useDeletePlan } from '@/services/query/hooks';

function PlanManager() {
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  
  const handleCreatePlan = async () => {
    try {
      await createPlan.mutateAsync({
        name: 'My Workout Plan',
        description: 'A beginner-friendly plan',
        difficulty: 'beginner',
        exercises: [
          {
            exercise_id: '123',
            order_index: 0,
            sets: 3,
            target_reps: '8-12',
          },
        ],
      });
      
      // Success! Plan created
    } catch (error) {
      // Handle error
      console.error('Failed to create plan:', error);
    }
  };
  
  return (
    <button 
      onClick={handleCreatePlan}
      disabled={createPlan.isPending}
    >
      {createPlan.isPending ? 'Creating...' : 'Create Plan'}
    </button>
  );
}
```

### Direct API Usage (Without React Query)

For cases where you need to use the API client directly:

```typescript
import { apiClient } from '@/services/api/client';
import { plansApi } from '@/services/api/endpoints';

// Using the low-level API client
async function fetchDataDirectly() {
  try {
    const response = await apiClient.get('/custom-endpoint');
    console.log(response);
  } catch (error) {
    // Error is automatically reported and typed as ApiClientError
    console.error(error.getUserMessage());
  }
}

// Using endpoint services
async function fetchPlans() {
  try {
    const plans = await plansApi.list({ difficulty: 'intermediate' });
    console.log(plans);
  } catch (error) {
    console.error('Failed to fetch plans:', error);
  }
}
```

## Error Handling

All API errors are automatically:
1. Typed as `ApiClientError` with useful methods
2. Reported to the error reporting system
3. Provide user-friendly error messages

```typescript
import { ApiClientError } from '@/services/api/errors';

function handleError(error: unknown) {
  if (error instanceof ApiClientError) {
    // Check error types
    if (error.isAuthError()) {
      // Redirect to login
    } else if (error.isNetworkError()) {
      // Show offline message
    } else {
      // Show user-friendly message
      alert(error.getUserMessage());
    }
  }
}
```

## Query Caching and Invalidation

```typescript
import { queryClient } from '@/services/query/client';
import { queryKeys } from '@/services/query/keys';

// Invalidate specific queries
queryClient.invalidateQueries({ queryKey: queryKeys.plans.all });

// Refetch a specific plan
queryClient.refetchQueries({ queryKey: queryKeys.plans.detail('plan-id') });

// Set data in cache manually
queryClient.setQueryData(queryKeys.user.profile(), updatedProfile);
```

## TypeScript Support

All API responses are fully typed:

```typescript
// Type is inferred automatically
const { data } = useExercises(); // data: PaginatedResponse<Exercise> | undefined

// Or use types directly
import type { Exercise, WorkoutPlan, UserProfile } from '@/services/api/endpoints';
```

## Configuration

API configuration can be found in:
- `src/services/api/config.ts` - Endpoints, timeouts, status codes
- `src/services/query/client.ts` - Query client configuration
- `src/config/env.ts` - Environment variables

## Best Practices

1. **Always use hooks when possible** - They handle caching, refetching, and error states
2. **Let errors bubble up** - The API client handles error reporting automatically
3. **Use proper query keys** - Use the `queryKeys` factory for consistency
4. **Leverage TypeScript** - All endpoints and responses are fully typed
5. **Handle loading states** - Always show appropriate UI during data fetching

## Available Hooks

### Query Hooks
- `useUserProfile()` - Fetch current user profile
- `useExercises(params?)` - Fetch exercises with optional filters
- `useExercise(id)` - Fetch single exercise
- `useExerciseSearch(query, params?)` - Search exercises
- `usePlans(params?)` - Fetch plans with optional filters  
- `usePlan(id)` - Fetch single plan

### Mutation Hooks
- `useCreatePlan()` - Create a new workout plan
- `useUpdatePlan()` - Update an existing plan
- `useDeletePlan()` - Delete a plan

### Utility Hooks
- `usePrefetchExercise()` - Prefetch exercise data
- `usePrefetchPlan()` - Prefetch plan data
- `useInvalidateUser()` - Invalidate user queries
- `useExerciseOptions()` - Get exercises formatted for dropdowns