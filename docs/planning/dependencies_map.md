# Dependencies Map - Slow Burn Frontend

This document tracks dependencies between tasks, sprints, and external systems to ensure smooth development flow.

## Sprint 3: Plan Creation Dependencies ✅ COMPLETE

### Achieved in Sprint 3
- ✅ Full CRUD operations for workout plans
- ✅ OpenAPI integration with backend schema
- ✅ Type-safe API client using openapi-react-query
- ✅ Comprehensive test coverage (515 tests passing)
- ✅ Sentinel value pattern for Radix UI components

### New Patterns Established
1. **API Integration**: All API calls use `$api` from openapi-react-query
2. **Type Generation**: Backend OpenAPI schema is single source of truth
3. **No Manual Types**: Eliminated all manual API type definitions
4. **Test Factories**: Updated for OpenAPI response formats in `@/test/factories/`

## Sprint 2: Authentication Dependencies ✅ COMPLETE

### External Dependencies
| Dependency | Required By | Status | Notes |
|------------|-------------|--------|-------|
| Supabase Project Setup | Task 1 | ✅ Configured | Environment variables configured |
| Backend API Running | Task 9 | ✅ Integrated | Full API integration complete |
| Backend JWT Validation | Task 9 | ✅ Working | JWT auth fully operational |

### Internal Task Dependencies
```
Task 1: Supabase Client Setup
└── Task 2: Auth Store Implementation
    ├── Task 3: Login Component
    ├── Task 4: Sign-up Component
    └── Task 7: Password Reset Flow
        
Task 5: Auth Layout
└── Task 8: Auth Pages & Routing
    └── Task 6: Protected Routes

Task 9: API Client Configuration (can be done in parallel)
└── Task 10: User Feedback Components

Task 11: Auth Tests (depends on all components)
```

## Sprint 4: Workout Logging Dependencies (UPCOMING)

### External Dependencies for Sprint 4
| Dependency | Required By | Status | Notes |
|------------|-------------|--------|-------|
| Plans API | Core Feature | ✅ Complete | Sprint 3 delivered full plans CRUD |
| Exercises API | Exercise Selection | 🟡 Backend Ready | `/api/v1/exercises` endpoint available |
| Workout Sessions API | Logging | 🟡 Backend Ready | `/api/v1/workouts` endpoint available |
| OpenAPI Schema Updates | Type Safety | 🟢 Automatic | Types auto-generated from backend |

### Sprint 4 Should Build On
1. **OpenAPI Infrastructure** from Sprint 3 - Use `$api` pattern for all new endpoints
2. **Form Patterns** from Sprint 2 & 3 - React Hook Form + Zod validation
3. **Toast Patterns** - Create `workoutToast` helper similar to `authToast` and `planToast`
4. **Test Factories** - Extend `@/test/factories/` with workout data factories

### Cross-Sprint Dependencies
- ✅ **Sprint 3 (Plan Creation)** → Completed, unblocks workout plan selection
- **Sprint 4 (Workout Logging)** → Will unblock Sprint 5 exercise tracking
- **Sprint 6 (AI Chat)** → Requires auth + workout history for context

## Configuration Requirements

### Current Configuration (All Sprints 1-3) ✅
All required configuration is complete:
- ✅ `VITE_SUPABASE_URL` - Configured
- ✅ `VITE_SUPABASE_ANON_KEY` - Configured
- ✅ `VITE_BACKEND_URL` - Configured (default: http://localhost:8000)
- ✅ Supabase email auth - Enabled
- ✅ Backend API - Running and integrated
- ✅ OpenAPI schema - Auto-generated types working

## Blocking Risks

### Sprint 4 Potential Blockers
1. **Exercise API Complexity**
   - Risk: Exercise data structure might be complex
   - Mitigation: Use OpenAPI types, start with minimal fields
   
2. **Offline Sync Requirements**
   - Risk: PWA offline functionality adds complexity
   - Mitigation: Defer to Sprint 8, focus on online-first for MVP

3. **Real-time Updates**
   - Risk: Live workout tracking might need WebSockets
   - Mitigation: Use polling or manual refresh for MVP

### Resolved Blockers (Sprints 1-3)
- ✅ Supabase credentials configured
- ✅ Backend API integrated
- ✅ Authentication working
- ✅ Plans API complete

## Key Architecture Decisions from Sprint 3

### OpenAPI-First Development
All future sprints should follow the OpenAPI pattern established in Sprint 3:
1. Backend updates OpenAPI schema
2. Frontend runs type generation: `pnpm run generate-types`
3. Use `$api` hooks for all API calls
4. No manual type definitions for API contracts

### Test Factory Pattern
When adding new features:
1. Add factories to `@/test/factories/[domain].ts`
2. Align with OpenAPI response formats
3. Use factories for consistent test data
4. Never duplicate mock helpers

### Component Patterns
1. Form validation: React Hook Form + Zod
2. User feedback: Domain-specific toast helpers (authToast, planToast, etc.)
3. Loading states: Consistent skeleton components
4. Error handling: Error boundaries with toast notifications

---

*Last Updated: 2025-08-09*