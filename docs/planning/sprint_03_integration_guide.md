# Sprint 3 Frontend Integration Guide: Plan Creation UI

## Executive Summary

This guide provides a comprehensive roadmap for integrating the frontend with the completed Sprint 3 backend Plan Creation APIs. The backend has delivered robust CRUD operations with versioning, soft deletes, and JWT authentication. The frontend already has foundational infrastructure in place (API client, TanStack Query hooks, TypeScript types from Supabase), making this integration straightforward.

**Key Success Factors:**
- Backend API is fully documented with OpenAPI schema
- Frontend already has plan-related hooks and types partially implemented
- Authentication patterns from Sprint 2 can be reused
- TanStack Query infrastructure is established

## 🎯 MVP Scope Clarification

Based on product decisions, the Sprint 3 MVP focuses on core functionality only:

### ✅ IN SCOPE for MVP
- **Basic CRUD**: Create, view, edit, and delete workout plans
- **Simple UI**: Single-page forms, basic list views
- **Core Fields**: Name, training style, description, duration, difficulty
- **Pagination**: Basic pagination for plan lists
- **Validation**: Client-side validation matching backend rules
- **Error Handling**: User-friendly error messages

### ❌ OUT OF SCOPE for MVP
- **Templates**: No pre-built plan templates
- **Duplication**: No ability to copy plans
- **Version History**: Backend tracks versions, but UI doesn't display them
- **Social Features**: No sharing, ratings, or following
- **Advanced Search**: Only basic search by name (if time permits)
- **Analytics**: No tracking or metrics
- **Bulk Operations**: No multi-select or batch actions
- **Export/Import**: No data export functionality

### 📋 Simple Preview Approach
When users create or view plans, show only a simple summary:
- Plan name and description
- Duration and difficulty
- Number of exercises (when available)
- No detailed workout previews or complex visualizations

---

## Section 1: Backend API Overview

### Available Endpoints

The backend provides five RESTful endpoints for plan management:

| Endpoint | Method | Purpose | Auth Required |
|----------|---------|---------|---------------|
| `/api/v1/plans` | POST | Create new workout plan | Yes |
| `/api/v1/plans` | GET | List user's plans (paginated) | Yes |
| `/api/v1/plans/{plan_id}` | GET | Get specific plan | Optional* |
| `/api/v1/plans/{plan_id}` | PUT | Update plan (creates version) | Yes |
| `/api/v1/plans/{plan_id}` | DELETE | Soft delete plan | Yes |

*Public plans can be viewed without authentication

### Data Models & Validation Rules

**Plan Creation (POST)**
```typescript
{
  name: string;           // Required, 1-100 chars
  training_style: enum;   // Required: powerlifting|bodybuilding|powerbuilding|general_fitness|athletic_performance
  description?: string;   // Optional, max 2000 chars
  goal?: string;         // Optional, max 200 chars
  difficulty_level?: enum; // Optional: beginner|intermediate|advanced
  duration_weeks?: number; // Optional, 1-52
  days_per_week?: number;  // Optional, 1-7
  is_public?: boolean;     // Default: false
  metadata?: object;       // Flexible JSON storage
}
```

**Plan Response**
```typescript
{
  id: UUID;
  name: string;
  description: string | null;
  training_style: string;
  goal: string | null;
  difficulty_level: string | null;
  duration_weeks: number | null;
  days_per_week: number | null;
  is_public: boolean;
  metadata: object;
  created_at: ISO8601 datetime;
}
```

### Versioning Behavior

The backend implements **immutable versioning**:
- Updates create new plan versions (incremented `version_number`)
- Original plans remain unchanged
- Only the latest version is marked `is_active=true`
- Version history tracked via `parent_plan_id`

### Business Rules

1. **Ownership**: Users can only modify their own plans
2. **Public Plans**: Viewable by anyone (including unauthenticated users)
3. **Soft Delete**: Plans marked as deleted but retained in database
4. **Active Sessions**: Plans with active workouts cannot be deleted
5. **Pagination**: Default 20 items, max 100 per page

---

## Section 2: TypeScript Integration Strategy

### Current State Analysis

The frontend already has:
- ✅ Database types from Supabase (`api.types.gen.ts`)
- ✅ API client with proper auth headers (`api/client.ts`)
- ✅ Plan endpoints partially implemented (`api/endpoints/plans.ts`)
- ✅ TanStack Query hooks (`query/hooks/use-plans.ts`)
- ⚠️ Missing: Direct types from FastAPI's OpenAPI schema

### Recommended Approach: Hybrid Type Generation

Since you already have database types from Supabase and a working API client, I recommend a **pragmatic hybrid approach**:

1. **Use existing Supabase types** for database entities
2. **Generate request/response types** from OpenAPI for API contracts
3. **Create mapping utilities** to bridge any gaps

### Implementation Steps

#### Step 1: Install OpenAPI TypeScript Generator

```bash
pnpm add -D openapi-typescript
```

#### Step 2: Add Generation Script to package.json

```json
{
  "scripts": {
    "gen:openapi": "npx openapi-typescript http://localhost:8000/openapi.json -o src/types/openapi.gen.ts",
    "gen:types": "pnpm gen:db-types && pnpm gen:api-types && pnpm gen:openapi"
  }
}
```

#### Step 3: Create Type Mappings

Create `/frontend/src/types/plans.ts`:

```typescript
import type { Plans } from './api.types.gen';
import type { components } from './openapi.gen';

// Backend API types
export type PlanCreateRequest = components['schemas']['PlanCreateModel'];
export type PlanUpdateRequest = components['schemas']['PlanUpdateModel'];
export type PlanResponse = components['schemas']['PlanResponseModel'];
export type PlanListResponse = components['schemas']['PaginatedResponse_PlanResponseModel_'];

// Enums with proper typing
export const TrainingStyle = {
  POWERLIFTING: 'powerlifting',
  BODYBUILDING: 'bodybuilding',
  POWERBUILDING: 'powerbuilding',
  GENERAL_FITNESS: 'general_fitness',
  ATHLETIC_PERFORMANCE: 'athletic_performance',
} as const;

export type TrainingStyleType = typeof TrainingStyle[keyof typeof TrainingStyle];

export const DifficultyLevel = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const;

export type DifficultyLevelType = typeof DifficultyLevel[keyof typeof DifficultyLevel];

// Mapper functions if needed
export const mapDatabasePlanToApiPlan = (dbPlan: Plans): PlanResponse => {
  return {
    ...dbPlan,
    created_at: dbPlan.created_at as string, // Ensure ISO string format
  };
};
```

---

## Section 3: Frontend Implementation Plan

### Component Hierarchy

```
/pages/plans/
├── PlansPage.tsx           // Main plans listing page
├── PlanCreatePage.tsx      // Plan creation form
├── PlanDetailPage.tsx      // View/edit specific plan
└── components/
    ├── PlansList.tsx       // Paginated plans grid/list
    ├── PlanCard.tsx        // Individual plan card
    ├── PlanForm.tsx        // Reusable form for create/edit
    ├── PlanVersionHistory.tsx // Version timeline
    └── PlanDeleteModal.tsx // Confirmation dialog
```

### State Management Approach

**Use React Context for form state, Zustand for global plan settings:**

```typescript
// /stores/plan-store.ts
interface PlanStore {
  // User preferences
  defaultTrainingStyle: TrainingStyleType;
  preferredDifficulty: DifficultyLevelType;
  
  // Active plan being edited
  activePlanId: string | null;
  isEditMode: boolean;
  
  // Actions
  setActivePlan: (id: string | null) => void;
  setEditMode: (enabled: boolean) => void;
}
```

### Enhanced TanStack Query Hooks

Update `/frontend/src/services/query/hooks/use-plans.ts`:

```typescript
// Add optimistic updates
export function useCreatePlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: plansApi.create,
    onMutate: async (newPlan) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: queryKeys.plans.lists() });
      
      // Snapshot previous value
      const previousPlans = queryClient.getQueryData(queryKeys.plans.lists());
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.plans.lists(), (old) => {
        if (!old) return old;
        return {
          ...old,
          items: [newPlan, ...old.items],
          total: old.total + 1,
        };
      });
      
      return { previousPlans };
    },
    onError: (err, newPlan, context) => {
      // Rollback on error
      if (context?.previousPlans) {
        queryClient.setQueryData(queryKeys.plans.lists(), context.previousPlans);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.lists() });
    },
  });
}
```

### Form Validation Strategy

Use Zod schemas that mirror backend validation:

```typescript
// /schemas/plan.schema.ts
import { z } from 'zod';

export const planCreateSchema = z.object({
  name: z.string().min(1).max(100),
  training_style: z.enum(['powerlifting', 'bodybuilding', 'powerbuilding', 'general_fitness', 'athletic_performance']),
  description: z.string().max(2000).optional(),
  goal: z.string().max(200).optional(),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  duration_weeks: z.number().int().min(1).max(52).optional(),
  days_per_week: z.number().int().min(1).max(7).optional(),
  is_public: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({}),
});

export type PlanCreateFormData = z.infer<typeof planCreateSchema>;
```

### Error Handling Patterns

```typescript
// /utils/plan-errors.ts
export const handlePlanError = (error: unknown): string => {
  if (error instanceof APIError) {
    switch (error.status) {
      case 400:
        if (error.message.includes('active workout sessions')) {
          return 'Cannot delete plan with active workouts. Complete or cancel them first.';
        }
        return 'Invalid plan data. Please check your inputs.';
      case 403:
        return 'You do not have permission to modify this plan.';
      case 404:
        return 'Plan not found or has been deleted.';
      case 409:
        return 'A newer version of this plan exists. Please refresh and try again.';
      default:
        return error.message;
    }
  }
  return 'An unexpected error occurred. Please try again.';
};
```

---

## Section 4: Development Workflow

### Step-by-Step Implementation Order

1. **Week 1: Foundation**
   - [ ] Generate OpenAPI types
   - [ ] Update plan API service with proper types
   - [ ] Enhance TanStack Query hooks with optimistic updates
   - [ ] Create Zod validation schemas

2. **Week 1-2: Core UI Components**
   - [ ] Build PlanForm component with react-hook-form
   - [ ] Create PlanCard component
   - [ ] Implement PlansList with pagination
   - [ ] Add loading skeletons

3. **Week 2: Page Implementation**
   - [ ] Create PlansPage with list view
   - [ ] Build PlanCreatePage with form
   - [ ] Implement PlanDetailPage with edit capability
   - [ ] Add routing configuration

4. **Week 2-3: Advanced Features**
   - [ ] Version history display
   - [ ] Soft delete with undo
   - [ ] Public plan sharing
   - [ ] Bulk operations

5. **Week 3: Polish & Testing**
   - [ ] Error boundary implementation
   - [ ] Accessibility audit
   - [ ] Performance optimization
   - [ ] Integration tests

### Leveraging Sprint 2 Patterns

Reuse these patterns from authentication work:

```typescript
// Auth guard pattern
const PlanCreatePage = () => {
  const { user } = useAuth(); // Existing auth hook
  
  if (!user) {
    return <Navigate to="/login" state={{ from: '/plans/new' }} />;
  }
  
  return <PlanForm />;
};

// API client already has auth headers
// No changes needed to api/client.ts
```

### Mock Data for Parallel Development

```typescript
// /mocks/plans.mock.ts
export const mockPlans: PlanResponse[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Upper/Lower Split',
    description: 'A 4-day upper/lower split focusing on compound movements',
    training_style: 'powerlifting',
    goal: 'strength',
    difficulty_level: 'intermediate',
    duration_weeks: 12,
    days_per_week: 4,
    is_public: false,
    metadata: { periodization: 'linear' },
    created_at: '2025-02-05T12:00:00Z',
  },
  // Add more mock data
];

// Use in development
const usePlans = import.meta.env.DEV 
  ? () => ({ data: { items: mockPlans, total: 10 }, isLoading: false })
  : actualUsePlans;
```

---

## Section 5: UI/UX Recommendations

### Component Selection from shadcn/ui

**Essential Components:**
- `Card` - For plan display
- `Form` + `Input` - Plan creation/editing
- `Select` - Training style, difficulty
- `Button` - Actions
- `Badge` - Plan metadata display
- `Tabs` - Plan sections
- `Dialog` - Delete confirmation
- `Toast` - Success/error notifications
- `Skeleton` - Loading states
- `Pagination` - List navigation

### Plan Creation Flow

```tsx
// Example form with shadcn/ui components
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PlanForm = () => {
  const form = useForm<PlanCreateFormData>({
    resolver: zodResolver(planCreateSchema),
    defaultValues: {
      training_style: 'general_fitness',
      difficulty_level: 'beginner',
      days_per_week: 3,
    },
  });

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="training_style"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Training Style</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select training style" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="powerlifting">Powerlifting</SelectItem>
                <SelectItem value="bodybuilding">Bodybuilding</SelectItem>
                <SelectItem value="powerbuilding">Powerbuilding</SelectItem>
                <SelectItem value="general_fitness">General Fitness</SelectItem>
                <SelectItem value="athletic_performance">Athletic Performance</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
    </Form>
  );
};
```

### Version History UI

```tsx
const PlanVersionHistory = ({ planId }: { planId: string }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Version History</h3>
      <div className="relative">
        {/* Version timeline */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        
        {versions.map((version, index) => (
          <div key={version.id} className="relative flex items-start pb-8">
            <div className="absolute left-4 -translate-x-1/2 w-3 h-3 rounded-full bg-primary" />
            <div className="ml-10">
              <Badge variant={version.is_active ? 'default' : 'secondary'}>
                v{version.version_number}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                {formatRelativeTime(version.created_at)}
              </p>
              <p className="text-sm mt-2">{version.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Mobile-First Responsive Design

```tsx
// Responsive plan card grid
const PlansList = () => {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {plans.map(plan => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
};

// Mobile-optimized form layout
const PlanForm = () => {
  return (
    <div className="space-y-6 max-w-2xl mx-auto px-4">
      {/* Stack fields vertically on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Form fields */}
      </div>
    </div>
  );
};
```

---

## Section 6: Technical Synergies

### Reusing Auth Patterns from Sprint 2

```typescript
// Existing auth context can be used directly
import { useAuth } from '@/contexts/AuthContext';

const PlanCreateButton = () => {
  const { user, signIn } = useAuth();
  
  if (!user) {
    return (
      <Button onClick={() => signIn()}>
        Sign in to create plans
      </Button>
    );
  }
  
  return (
    <Button asChild>
      <Link to="/plans/new">Create Plan</Link>
    </Button>
  );
};
```

### Shared Utilities

Create `/frontend/src/utils/plans.ts`:

```typescript
// Plan-specific utilities
export const getPlanDurationLabel = (weeks?: number | null): string => {
  if (!weeks) return 'Ongoing';
  if (weeks === 1) return '1 week';
  if (weeks < 4) return `${weeks} weeks`;
  if (weeks === 4) return '1 month';
  if (weeks < 52) return `${Math.round(weeks / 4)} months`;
  return '1 year';
};

export const getTrainingStyleIcon = (style: TrainingStyleType): LucideIcon => {
  const icons: Record<TrainingStyleType, LucideIcon> = {
    powerlifting: Dumbbell,
    bodybuilding: Flex,
    powerbuilding: Zap,
    general_fitness: Heart,
    athletic_performance: Trophy,
  };
  return icons[style] || Activity;
};

export const canEditPlan = (plan: PlanResponse, userId: string): boolean => {
  return plan.user_id === userId && plan.is_active && !plan.deleted_at;
};
```

### Performance Optimizations

```typescript
// Implement infinite scrolling for large plan lists
import { useInfiniteQuery } from '@tanstack/react-query';

export const useInfinitePlans = (params?: PlanQueryParams) => {
  return useInfiniteQuery({
    queryKey: [...queryKeys.plans.lists(), params],
    queryFn: ({ pageParam = 0 }) => 
      plansApi.list({ ...params, offset: pageParam, limit: 20 }),
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.length * 20;
      return loadedCount < lastPage.total ? loadedCount : undefined;
    },
    initialPageParam: 0,
  });
};

// Implement virtual scrolling for very long lists
import { useVirtualizer } from '@tanstack/react-virtual';

const VirtualPlansList = ({ plans }: { plans: Plan[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: plans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Estimated card height
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <PlanCard plan={plans[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Caching Strategy

```typescript
// Configure query client for optimal caching
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error) => {
        if (error instanceof APIError && error.status === 404) {
          return false; // Don't retry 404s
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});

// Prefetch plans on app load
export const prefetchUserPlans = async () => {
  await queryClient.prefetchQuery({
    queryKey: queryKeys.plans.lists(),
    queryFn: () => plansApi.list({ limit: 20 }),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};
```

---

## Section 7: Open Questions for Product Team

### UI/UX Decisions Needed

1. **Plan Templates**: Should we provide pre-built plan templates for common training goals?
   - Not now, out of scope

2. **Plan Duplication**: Should users be able to duplicate existing plans?
   - Not now, out of scope

3. **Plan Preview**: How detailed should the preview be before creation?
   - Simple summary view, can expand later if needed

4. **Version Display**: How should we present version history to users?
   - Not now, out of scope

5. **Social Features**: Are we planning social features?
   - Not now, out of scope

### Business Logic Clarifications

1. **Plan Limits**: ℹ️ **FOR MVP** - No hard limits, but consider reasonable defaults:
   - No limit on number of plans per user
   - No complexity restrictions
   - Public/private flag available but no special restrictions

2. **Plan Archival**: ✅ **RESOLVED** - Backend implements soft delete with `deleted_at` timestamp. Plans are never permanently deleted in MVP.

3. **Plan Sharing**: ❌ **NOT IN MVP** - No sharing features in initial release

4. **Analytics**: ❌ **NOT IN MVP** - No analytics tracking in initial release

### Feature Prioritization (UPDATED FOR MVP)

Simplified priority order for Sprint 3 MVP:

**Must Have (Week 1)**
- Basic CRUD operations (create, read, update, delete)
- Form validation matching backend rules
- Error handling with user-friendly messages
- List view with pagination
- Responsive design (mobile-first)

**Nice to Have (Week 2 - Only if time permits)**
- Basic search by plan name
- Simple sorting (by date, name)
- Public/private toggle

**NOT IN MVP (Deferred to Future Sprints)**
- Version history display (backend tracks it, UI doesn't show it)
- Plan templates (users create from scratch)
- Plan duplication
- Bulk operations
- Advanced filters
- Export functionality
- Social features
- Analytics dashboard
- AI plan generation
- Full exercise library integration

---

## Section 8: Risk Mitigation

### Potential Integration Challenges

#### 1. Type Mismatches
**Risk**: OpenAPI types might not align with database types  
**Mitigation**: 
- Create type mapping layer
- Use runtime validation with Zod
- Add type guards at API boundaries

```typescript
// Type guard example
const isPlanResponse = (data: unknown): data is PlanResponse => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'training_style' in data
  );
};
```

#### 2. Version Conflicts
**Risk**: Concurrent edits creating conflicting versions  
**Mitigation**:
- Implement optimistic locking with version numbers
- Show conflict resolution UI
- Auto-refresh stale data

```typescript
// Conflict detection
const handleUpdateConflict = async (plan: Plan, updates: UpdatePlanData) => {
  try {
    return await plansApi.update(plan.id, updates);
  } catch (error) {
    if (error.status === 409) {
      // Fetch latest version
      const latest = await plansApi.get(plan.id);
      // Show conflict resolution dialog
      return showConflictDialog(plan, latest, updates);
    }
    throw error;
  }
};
```

#### 3. Large Dataset Performance
**Risk**: Performance degradation with many plans  
**Mitigation**:
- Implement virtual scrolling
- Use pagination effectively
- Add search/filter to reduce dataset
- Consider IndexedDB for offline caching

### Fallback Approaches

1. **If OpenAPI generation fails**: Use manually maintained types
2. **If versioning is too complex**: Hide version UI initially
3. **If performance issues arise**: Implement server-side search
4. **If offline support is problematic**: Provide clear online-only messaging

### Testing Requirements

**Unit Tests**
```typescript
// Example test for plan creation
describe('PlanForm', () => {
  it('validates required fields', async () => {
    render(<PlanForm />);
    
    const submitButton = screen.getByRole('button', { name: /create plan/i });
    await userEvent.click(submitButton);
    
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/training style is required/i)).toBeInTheDocument();
  });
  
  it('submits valid form data', async () => {
    const mockCreate = vi.fn();
    render(<PlanForm onSubmit={mockCreate} />);
    
    await userEvent.type(screen.getByLabelText(/name/i), 'Test Plan');
    await userEvent.selectOptions(screen.getByLabelText(/training style/i), 'powerlifting');
    await userEvent.click(screen.getByRole('button', { name: /create plan/i }));
    
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Plan',
        training_style: 'powerlifting',
      })
    );
  });
});
```

**Integration Tests**
```typescript
// Test full create-read-update-delete flow
describe('Plan CRUD Operations', () => {
  it('completes full plan lifecycle', async () => {
    // Create
    const plan = await plansApi.create({
      name: 'Integration Test Plan',
      training_style: 'general_fitness',
    });
    expect(plan.id).toBeDefined();
    
    // Read
    const fetched = await plansApi.get(plan.id);
    expect(fetched.name).toBe('Integration Test Plan');
    
    // Update
    const updated = await plansApi.update(plan.id, {
      name: 'Updated Test Plan',
    });
    expect(updated.version_number).toBe(2);
    
    // Delete
    await plansApi.delete(updated.id);
    await expect(plansApi.get(plan.id)).rejects.toThrow();
  });
});
```

### Performance Considerations

1. **Bundle Size**: Monitor impact of new dependencies
   - Consider dynamic imports for large components
   - Tree-shake unused shadcn/ui components

2. **API Call Optimization**:
   - Batch requests where possible
   - Implement request deduplication
   - Use stale-while-revalidate pattern

3. **Render Performance**:
   - Memoize expensive computations
   - Use React.memo for pure components
   - Implement windowing for long lists

---

## Appendix: Quick Reference

### API Endpoints
- `POST /api/v1/plans` - Create plan
- `GET /api/v1/plans` - List plans
- `GET /api/v1/plans/{id}` - Get plan
- `PUT /api/v1/plans/{id}` - Update plan
- `DELETE /api/v1/plans/{id}` - Delete plan

### Key Files to Modify
- `/src/services/api/endpoints/plans.ts` - API integration
- `/src/services/query/hooks/use-plans.ts` - React Query hooks
- `/src/types/plans.ts` - TypeScript types
- `/src/pages/plans/*` - UI components
- `/src/schemas/plan.schema.ts` - Validation

### NPM Scripts
```bash
pnpm gen:openapi     # Generate OpenAPI types
pnpm dev            # Start dev server
pnpm test           # Run tests
pnpm typecheck      # Check TypeScript
```

### Useful Resources
- [FastAPI OpenAPI Schema](http://localhost:8000/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [TanStack Query Docs](https://tanstack.com/query)
- [React Hook Form](https://react-hook-form.com)
- [Zod Validation](https://zod.dev)

---

## Next Steps

1. **Immediate Actions** (Today):
   - Set up OpenAPI type generation
   - Review and update existing plan types
   - Create initial PlanForm component

2. **This Week**:
   - Complete core CRUD UI
   - Implement validation
   - Add error handling

3. **Next Week**:
   - Add version history UI
   - Implement filters and search
   - Performance optimization

4. **Final Week**:
   - Polish and accessibility
   - Comprehensive testing
   - Documentation

---

*This guide is a living document. Update it as implementation progresses and new requirements emerge.*