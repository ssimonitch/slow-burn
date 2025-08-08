# Sprint 03: Plan Creation
**Sprint Duration:** 2025-02-03 - 2025-02-09  
**Primary Goal:** Build a simple, functional UI for creating and managing workout plans with focus on core CRUD operations

## Executive Summary

Sprint 3 delivers the Plan Creation feature - a foundational component that enables users to create, view, edit, and delete their workout plans. Following our MVP philosophy and react-architect feedback, we'll focus on the absolute essentials with maximum simplification, targeting a working vertical slice by end of Monday.

## Sprint Goals

1. **Core CRUD Operations**: Implement create, read, update, and delete functionality for workout plans
2. **Simple UI/UX**: Build an intuitive interface using existing patterns from Sprint 2
3. **Backend Integration**: Connect to FastAPI endpoints with proper error handling
4. **Form Validation**: Implement client-side validation matching backend requirements
5. **Responsive Design**: Ensure mobile-first responsive layouts

## MVP Scope Definition

### ✅ IN SCOPE - What We're Building

**Core Features (Simplified per react-architect feedback):**
- Create new workout plans with only 4 fields (name, description, training style, difficulty)
- View list of user's plans with simple pagination
- Edit existing plans (creates new version in backend, but UI doesn't show history)
- Delete plans (soft delete)
- Basic form validation with error messages
- Loading states and error handling
- Toast notifications using planToast helper (similar to authToast)

**UI Components (Minimal):**
- Simplified plan creation form (4 fields only)
- Basic plan list view with cards
- Edit capability (reusing the same form)
- Delete confirmation dialog
- Simple pagination (no infinite scroll or virtual scrolling)

### ❌ OUT OF SCOPE - What We're NOT Building

**Deferred Features:**
- Plan templates or pre-built plans
- Version history display (backend tracks it, UI ignores it)
- Plan duplication/copying
- Social features (sharing, ratings, comments)
- ANY filtering or search functionality
- Bulk operations (multi-select, batch delete)
- Export/import functionality
- Exercise integration (plans exist but don't contain exercises yet)
- Analytics or metrics
- AI-generated plans
- Virtual scrolling or infinite scroll
- Complex state management (Zustand store for preferences)
- OpenAPI type generation

## Technical Approach

### Simplified Implementation Strategy

Based on react-architect feedback, we're taking a radically simplified approach:

**Key Simplifications:**
- **No OpenAPI type generation**: Use manual TypeScript interfaces (existing types are sufficient)
- **No Zustand store**: Use local component state for form data
- **Minimal form fields**: Only 4 fields initially (name, description, training style, difficulty)
- **Install shadcn components as needed**: Don't pre-install, add only when required
- **Simple pagination**: Basic previous/next, no fancy features
- **planToast helper**: Create similar to existing authToast pattern

### Leveraging Existing Infrastructure

We'll build on Sprint 2's foundations:
- **Authentication**: Use existing `useAuthStore` and protected routes
- **API Client**: Extend existing TanStack Query setup
- **Error Handling**: Reuse error boundary patterns and toast notifications
- **Forms**: Apply same validation patterns with Zod and react-hook-form
- **UI Components**: Install shadcn/ui components only as needed
- **Testing**: Follow established testing patterns

### Simplified Components Structure

```
src/
├── pages/
│   └── plans/
│       └── PlansPage.tsx          # Combined list view and create/edit
├── features/
│   └── plans/
│       ├── components/
│       │   ├── PlanForm.tsx        # Simple 4-field form
│       │   ├── PlanCard.tsx        # Basic plan display card
│       │   └── DeletePlanDialog.tsx # Confirmation modal
│       ├── hooks/
│       │   └── use-plans.ts        # TanStack Query hooks
│       ├── schemas/
│       │   └── plan.schema.ts      # Zod validation (4 fields)
│       └── utils/
│           └── planToast.ts        # Toast helper like authToast
└── services/
    └── api/
        └── endpoints/
            └── plans.ts            # API endpoint functions
```

## Task Breakdown (Simplified for Achievability)

### Task 1: Basic API Setup & Manual Types
**Description:** Create simple TypeScript interfaces and API functions (no OpenAPI generation)  
**User Story:** As a developer, I need basic typed API functions  
**Dependencies:** None  
**Estimated Effort:** 1 hour  
**Acceptance Criteria:**
- Manual TypeScript interfaces for Plan type (4 fields)
- Simple API functions using existing patterns
- Basic error handling
**Assigned To:** Developer

### Task 2: TanStack Query Hooks & planToast Helper
**Description:** Create React Query hooks and toast helper similar to authToast  
**User Story:** As a developer, I need data fetching hooks and consistent feedback  
**Dependencies:** Task 1  
**Estimated Effort:** 1.5 hours  
**Acceptance Criteria:**
- Basic hooks for CRUD operations
- planToast helper matching authToast pattern
- Simple cache invalidation
**Assigned To:** Developer

### Task 3: Minimal Plan Form (4 Fields)
**Description:** Build simplified form with only name, description, training style, difficulty  
**User Story:** As a user, I want to quickly create a workout plan  
**Dependencies:** Task 1  
**Estimated Effort:** 2 hours  
**Acceptance Criteria:**
- Only 4 form fields
- Basic Zod validation
- Local state management (no Zustand)
- Works for both create and edit
**Assigned To:** Developer

### Task 4: Simple Plan List
**Description:** Create basic list view with cards and simple pagination  
**User Story:** As a user, I want to see my workout plans  
**Dependencies:** Task 2  
**Estimated Effort:** 2 hours  
**Acceptance Criteria:**
- Basic card layout
- Simple previous/next pagination (no infinite scroll)
- Loading and empty states
- Click to edit
**Assigned To:** Developer

### Task 5: Combined Plans Page
**Description:** Single page handling list, create, and edit (no separate pages)  
**User Story:** As a user, I want one simple place to manage plans  
**Dependencies:** Tasks 3, 4  
**Estimated Effort:** 1.5 hours  
**Acceptance Criteria:**
- Single PlansPage.tsx component
- Modal or inline form for create/edit
- Simple routing
**Assigned To:** Developer

### Task 6: Delete with Confirmation
**Description:** Add delete button with simple confirmation dialog  
**User Story:** As a user, I want to safely delete plans  
**Dependencies:** Task 2  
**Estimated Effort:** 1 hour  
**Acceptance Criteria:**
- Delete button on cards
- Basic confirmation dialog
- planToast feedback
**Assigned To:** Developer

### Task 7: Basic Error Handling
**Description:** Add essential error handling and loading states  
**User Story:** As a user, I want to know when something goes wrong  
**Dependencies:** Tasks 1-6  
**Estimated Effort:** 1 hour  
**Acceptance Criteria:**
- Loading spinners
- Error messages in UI
- planToast for failures
**Assigned To:** Developer

### Task 8: Essential Tests Only
**Description:** Write only critical tests for main functionality  
**User Story:** As a developer, I need basic test coverage  
**Dependencies:** Tasks 1-7  
**Estimated Effort:** 2 hours  
**Acceptance Criteria:**
- Test form validation
- Test main user flows
- Skip exhaustive testing for MVP
**Assigned To:** Developer

## Success Criteria (Simplified)

Sprint 3 is successful when:
1. Users can create new workout plans with 4 fields (name, description, training style, difficulty)
2. Users can view their plans in a simple paginated list
3. Users can edit existing plans (same 4-field form)
4. Users can delete plans with confirmation
5. Basic validation and error messages work
6. The feature works on mobile (responsive)
7. planToast provides user feedback
8. Basic tests pass (not aiming for high coverage)

## Risk Mitigation

### Identified Risks & Mitigations

1. **Type Mismatches with Backend**
   - Risk: API types don't match frontend expectations
   - Mitigation: Use Zod for runtime validation, create type guards
   - Fallback: Manual type definitions if code generation fails

2. **Complex Version Management**
   - Risk: Version system confuses users or complicates UI
   - Mitigation: Hide versioning complexity in MVP, show only latest
   - Fallback: Treat all updates as simple overwrites in UI

3. **Performance with Many Plans**
   - Risk: UI becomes slow with large plan lists
   - Mitigation: Implement pagination from start, limit page size
   - Fallback: Add search/filter to reduce displayed items

4. **Form Complexity**
   - Risk: Too many fields overwhelm users
   - Mitigation: Start with minimal required fields, progressive disclosure
   - Fallback: Split into multi-step form if needed

## Dependencies & Blockers

### Dependencies
- ✅ **Backend API Ready**: Plan endpoints are complete and documented
- ✅ **Authentication System**: Sprint 2 auth is working
- ✅ **UI Component Library**: shadcn/ui is set up
- ✅ **API Client**: TanStack Query infrastructure exists

### Potential Blockers
- Backend API changes or bugs (coordinate with backend team)
- Unclear requirements for plan fields (get product clarification early)
- Performance issues with pagination (test with realistic data volumes)

## Daily Execution Plan (Aggressive Timeline)

### Monday (Feb 3) - CRITICAL: Working Vertical Slice
**Goal: Get a functional create/read flow working end-to-end**
- Morning: API setup and types (Task 1) - 1 hour
- Morning: TanStack Query hooks & planToast (Task 2) - 1.5 hours
- Afternoon: Minimal form component (Task 3) - 2 hours
- Afternoon: Basic list view (Task 4) - 2 hours
- End of Day: Combined page with routing (Task 5) - 1.5 hours
**Deliverable: Users can create and view plans**

### Tuesday (Feb 4) - Complete CRUD
- Morning: Delete functionality (Task 6) - 1 hour
- Morning: Error handling (Task 7) - 1 hour
- Afternoon: Edit functionality polish
- Afternoon: Mobile responsiveness check
**Deliverable: Full CRUD operations working**

### Wednesday (Feb 5) - Polish & Test
- Morning: Essential tests (Task 8) - 2 hours
- Afternoon: Bug fixes and UI polish
- Afternoon: Manual testing on mobile
**Deliverable: Tested and polished feature**

### Thursday (Feb 6) - Buffer & Enhancement
- Fix any discovered issues
- Add any quick wins if time permits
- Prepare for integration with Sprint 4

### Friday (Feb 7) - Final Polish
- Final testing and bug fixes
- Documentation updates if needed
- Sprint retrospective and planning for Sprint 4

## Technical Decisions (Simplified per Feedback)

### Form Library
Use `react-hook-form` with `zod` for validation (same as Sprint 2 auth forms)

### State Management
- **Local form state only** with react-hook-form (NO Zustand store)
- Server state with TanStack Query
- No preferences or complex state management

### Type Generation
- **Manual TypeScript interfaces** (NO OpenAPI generation)
- Copy types from backend documentation as needed
- Keep interfaces simple and focused

### UI Components
- **Install shadcn components only as needed** (don't pre-install)
- Use existing patterns from Sprint 2
- Keep UI minimal and functional

### Pagination
- **Simple previous/next buttons** (NO infinite scroll or virtual scrolling)
- Basic page state management
- Fixed page size (e.g., 10 items per page)

### Testing Strategy
- **Essential tests only** for MVP
- Focus on critical paths
- Skip comprehensive coverage for speed

## Definition of Done

A task is complete when:
- [ ] Code is written and working
- [ ] TypeScript has no errors
- [ ] ESLint and Prettier pass
- [ ] Component has proper loading and error states
- [ ] Mobile responsive design is verified
- [ ] Basic tests are written and passing
- [ ] Code is reviewed (self-review for solo dev)
- [ ] Feature is manually tested
- [ ] Any documentation is updated

## Notes & Reminders

- **Keep it simple**: This is MVP - avoid over-engineering
- **Reuse patterns**: Follow Sprint 2's established patterns
- **User-first**: Focus on intuitive UX over feature richness
- **Progressive enhancement**: Ship basic version, enhance if time permits
- **Fail gracefully**: Always provide user feedback for errors
- **Mobile matters**: Test on actual mobile devices, not just browser DevTools
- **Ask questions early**: Get clarification on requirements ASAP

## Open Questions for Product Manager

While we agree with most of the simplifications suggested by the react-architect, there are a few areas where product clarification would be helpful:

### 1. Form Field Selection
**Current Decision:** Only 4 fields (name, description, training style, difficulty)  
**Question:** Are these the absolutely essential fields? Should we include:
- Duration/weeks (how long is the plan?)
- Days per week (training frequency)?
- Goal (muscle building, strength, endurance)?

### 2. Training Style Options
**Question:** What are the specific options for "training style"?
- Powerlifting, Bodybuilding, Hybrid, General Fitness?
- Or simpler: Strength, Hypertrophy, Mixed?

### 3. Difficulty Levels
**Question:** What difficulty scale should we use?
- Beginner, Intermediate, Advanced?
- 1-5 numeric scale?
- Easy, Medium, Hard?

### 4. Plan List Display
**Question:** What information is most important to show on plan cards?
- Just name and difficulty?
- Include description preview?
- Show created/modified dates?

### 5. Future Exercise Integration
**Question:** Should the UI hint at future exercise capability?
- Add disabled "Add Exercises" button as placeholder?
- Or keep it completely hidden until Sprint 4?

**Note:** We're proceeding with the simplified approach and can adjust based on feedback. The goal is to have something working by end of Monday that we can iterate on.

## Post-Sprint Considerations

After Sprint 3, we'll have the foundation for:
- Sprint 4: Adding exercises to plans
- Sprint 5: Workout logging with selected plans
- Future: Plan templates, sharing, analytics

The plan system is intentionally simple to allow for future enhancements without major refactoring.

---

*Sprint planned: 2025-08-08*  
*Updated with react-architect feedback: 2025-08-08*  
*Total estimated effort: ~12 hours (down from ~26 hours)*  
*Target: Working vertical slice by end of Monday, February 3, 2025*