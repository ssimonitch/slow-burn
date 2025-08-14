I reviewed the entire `src` tree for architecture, correctness, and readiness for sprint 4. Overall, the codebase is strong: clear feature folders, type-safe OpenAPI client with React Query integration, robust auth via Supabase + Zustand, consistent UI patterns, centralized error handling/logging/toast, and thorough tests. Below are targeted, high-signal recommendations, prioritized.

### Must-fix before sprint 4
- Duplicate global error handler registration
  - Registered in both `main.tsx` and `App.tsx`. This can cause double logging and multiple listeners.
  - Fix: keep initialization in `main.tsx` only; remove the `useEffect` in `App.tsx`.

    ```7:21:/Users/slim/Projects/slow-burn/frontend/src/main.tsx
    // Initialize error reporting before anything else
    setupGlobalErrorHandlers();
    ```

    ```76:83:/Users/slim/Projects/slow-burn/frontend/src/App.tsx
    // Set up global error handlers on mount
    useEffect(() => {
    setupGlobalErrorHandlers();
    }, []);
    ```

- Side-effects during render in `useAuthInit`
  - The hook invokes `initialize()` directly during render. While guarded, this is an anti-pattern and risks unnecessary calls.
  - Fix: call `initialize()` in a `useEffect`.

    ```344:355:/Users/slim/Projects/slow-burn/frontend/src/stores/auth.store.ts
    export const useAuthInit = () => {
    const initialize = useAuthStore((state) => state.initialize);
    const cleanup = useAuthStore((state) => state.cleanup);
    const initialized = useAuthStore((state) => state.initialized);

    // Initialize on mount
    if (!initialized) {
        void initialize();
    }

    return { initialized, cleanup };
    };
    ```

### High-priority cleanup
- Conflicting “ApiClientError” types
  - Two different classes are exported as `ApiClientError`:
    - A custom class in the OpenAPI client:
    ```45:71:/Users/slim/Projects/slow-burn/frontend/src/lib/api/client.ts
    export class ApiClientError extends Error {
    status: number;
    data: ApiError;
    ...
    }
    ```
    - An alias to `ApiError` exported under the same name:
    ```71:73:/Users/slim/Projects/slow-burn/frontend/src/services/api/errors.ts
    // Re-export ApiError for backward compatibility
    export { ApiError as ApiClientError };
    ```
  - Risk: confusion and subtle type bugs. Unify naming:
    - Option A: keep `ApiClientError` only in `lib/api/client.ts`; stop aliasing in `services/api/errors.ts`.
    - Option B: rename one explicitly (e.g., `ApiHttpError`) and update imports.

- Duplicate query key factories
  - Two separate `queryKeys` live in:
    ```11:50:/Users/slim/Projects/slow-burn/frontend/src/services/query/keys.ts
    export const queryKeys = { ... }
    ```
    ```30:69:/Users/slim/Projects/slow-burn/frontend/src/lib/api/hooks.ts
    export const queryKeys = { ... }
    ```
  - Recommendation: consolidate on the OpenAPI-aligned keys in `lib/api/hooks.ts`. Remove or deprecate `services/query/keys.ts`.

- Split API configuration between `services` and `lib`
  - `lib/api/client` imports `API_BASE_URL` from `services/api/config.ts`. Also `services/api/endpoints` is deprecated.
  - Recommendation: co-locate API config with the OpenAPI client in `lib/api/` and remove legacy `ENDPOINTS`. Keep `HTTP_STATUS` where it’s used (or colocate with error handling in `lib/api`).

### Medium-priority improvements
- Router structure
  - Consider lazy-loading routes (React.lazy + Suspense) for `Dashboard`, `PlansPage`, and auth pages to keep the initial bundle small. Add a global `Suspense` fallback around `RouterProvider`.
  - Optionally add `errorElement` per route to use your `ErrorBoundary` at the route level.

- ProtectedRoute UX
  - Current loader UI duplicates the app-level “loading your fitness journey…” UI. Consider reusing a common `LoadingOverlay` component for consistency.

- Supabase storage
  - You already note the intent to move to httpOnly cookies later. For MVP it’s OK; document in `docs` or `README` that tokens are stored in `localStorage` intentionally for now.

- OpenAPI client middleware ordering and behaviors
  - Order is good (offline → auth → retry → error). Consider adding an AbortController helper for cancellable requests in components with rapid re-renders (optional).

- Network status hook + offline middleware
  - Both show connection-related toasts. That’s fine but may double-notify edge cases. If you see duplicate toasts in practice, gate with a simple last-toast timestamp.

- Security helpers
  - `validateSecureEnvironment` forces HTTPS redirect in production. Document this in deployment notes to avoid surprise behavior in preview/staging.

### Low-priority polish
- Consistent folder naming
  - You have both `lib/` and `services/`. Suggest converging to one (e.g., move `services/query` and `services/api` concerns into `lib/api` to match your OpenAPI-first approach).

- Tests
  - Great coverage patterns. When you consolidate query keys and API errors, adjust unit tests accordingly. Keep the excellent `test/helpers` utilities.

- Minor typing/UX details
  - In `PlanForm`, the `error` prop is typed as `Error | null`, but upstream mutations will often use the OpenAPI error class. If you unify `ApiClientError`, you can tailor the user message in the form.

### Overall readiness
- Architecture aligns with the brief: SPA, React Router, Zustand + TanStack Query, Supabase auth, PWA-ready scaffolding (to follow in sprint 8).
- The sprint 4 “Workout Logging” work can proceed without major risk if you address the must-fix items and the `ApiClientError` duplication. The OpenAPI client and cache utilities will serve the logging feature well, including offline work later.

- Concrete edits to do first (no behavioral change, low risk):
  - Remove duplicate `setupGlobalErrorHandlers` call in `App.tsx`.
  - Update `useAuthInit` to use `useEffect`.
  - Pick one `ApiClientError` and one `queryKeys` source; update imports accordingly.
  - Co-locate `API_BASE_URL` with `lib/api` to remove `services/api/endpoints` drift.

- Optional, quick wins:
  - Add `React.Suspense` around router and lazy-load pages.
  - Use shared `LoadingOverlay` in `ProtectedRoute`.

- Longer-term:
  - Consolidate `lib/` vs `services/` to reduce cognitive load.
  - Prepare IndexedDB adapters for sprint 4/8 offline workflows (Dexie-based utility stub).