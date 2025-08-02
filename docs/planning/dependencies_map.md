# Dependencies Map - Slow Burn Frontend

This document tracks dependencies between tasks, sprints, and external systems to ensure smooth development flow.

## Sprint 2: Authentication Dependencies

### External Dependencies
| Dependency | Required By | Status | Notes |
|------------|-------------|--------|-------|
| Supabase Project Setup | Task 1 | 🔴 Not Configured | Need VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY |
| Backend API Running | Task 9 | 🟡 Optional for Sprint 2 | Can develop auth UI without backend initially |
| Backend JWT Validation | Task 9 | 🟡 Optional for Sprint 2 | Backend validates JWTs but frontend can work independently |

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

### Cross-Sprint Dependencies
- **Sprint 3 (Plan Creation)** → Requires completed authentication
- **Sprint 4 (Workout Logging)** → Requires auth + plan creation
- **Sprint 6 (AI Chat)** → Requires auth for user context

## Configuration Requirements

### Sprint 2 Start Requirements
1. **Supabase Credentials**
   - `VITE_SUPABASE_URL` - The Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - The public anon key for client-side usage
   
2. **Backend API (Optional for UI Development)**
   - `VITE_BACKEND_URL` - Backend API URL (default: http://localhost:8000)
   - Backend should be running for Task 9 testing

### Environment Setup Checklist
- [ ] Copy `.env.example` to `.env.local`
- [ ] Add Supabase project URL
- [ ] Add Supabase anon key
- [ ] Configure backend URL (if different from default)
- [ ] Verify Supabase has email auth enabled

## Blocking Risks

### High Priority Blockers
1. **Missing Supabase Credentials**
   - Blocks: Task 1, and consequently all auth tasks
   - Resolution: Obtain from backend team or create new Supabase project

### Medium Priority Blockers
1. **Backend API Unavailable**
   - Blocks: Task 9 full testing
   - Resolution: Can develop with mocked responses initially

## Task Sequencing Strategy

### Recommended Order
1. **Get Supabase Credentials** (Pre-sprint)
2. **Task 1 & 5** (Parallel) - Foundation work
3. **Task 2** - Core state management
4. **Tasks 3, 4, 8** (Parallel) - UI components
5. **Task 6** - Route protection
6. **Task 7** - Password reset
7. **Task 9** - Backend integration
8. **Task 10** - Polish
9. **Task 11** - Testing

### Critical Path
Task 1 → Task 2 → Task 3/4 → Task 6

This path represents the minimum viable authentication flow.

---

*Last Updated: 2025-02-01*