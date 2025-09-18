# Project Bootstrap Plan — Slow Burn MVP

## 1. Overview
- Goal: stand up the mobile-first HIIT PWA described in the system specs with a minimal but scalable React + Vite codebase, preserving on-device pose, an event-driven core, and high-quality audio.
- Deliverables: baseline repository structure, configuration stubs for workers/service worker, testing harness, Supabase migrations folder, and slots for recorded audio + model assets. No packages are installed yet; this is the blueprint to follow when we are ready to scaffold.

## 2. Recommended Stack (latest stable releases)
- React 19 + TypeScript 5 for the UI shell and component model (hooks, concurrent rendering, stable suspense APIs) ([Context7:/reactjs/react.dev]).
- Vite 7 with the React SWC template for fast dev server, TS-first DX, and straightforward worker bundling ([Context7:/vitejs/vite]).
- TanStack Query 5.8x for server-state orchestration, background refetch, and mutation flows ([Context7:/tanstack/query]).
- Zustand 5 for optional client-side state islands (only where event log/state machine doesn’t fit) with slice pattern support ([Context7:/websites/zustand_pmnd_rs]).
- Supabase CLI + `@supabase/supabase-js` 2.x for lightweight Postgres, migrations, and future RLS hooks ([Context7:/supabase/supabase]).
- Workbox 7 for build-time precaching of the voice/pose assets and runtime caching strategies ([Context7:/googlechrome/workbox]).
- Vitest 2 + @testing-library/react for unit/component tests aligned with Vite ([Context7:/vitest-dev/vitest]).
- Playwright 1.48+ for cross-browser E2E and interaction tests, with component testing mode for critical flows ([Context7:/microsoft/playwright]).

## 3. Proposed Repository Layout
```text
slow-burn/
├─ docs/
│  └─ ... (existing specs)
├─ packages/
│  ├─ app/                  # React PWA front-end (Vite project)
│  │  ├─ public/
│  │  │  ├─ audio/          # Recorded prompt/rep samples (MVP catalog)
│  │  │  ├─ models/         # Pose model artifacts
│  │  │  └─ manifest.webmanifest
│  │  ├─ src/
│  │  │  ├─ app/            # Routing, providers, shell
│  │  │  ├─ features/
│  │  │  │  ├─ workout-engine/
│  │  │  │  ├─ pose/
│  │  │  │  └─ voice/
│  │  │  ├─ lib/            # Shared utilities (time, formatting)
│  │  │  ├─ services/
│  │  │  │  ├─ event-bus/
│  │  │  │  ├─ storage/
│  │  │  │  └─ supabase/
│  │  │  ├─ workers/
│  │  │  │  ├─ pose-worker.ts
│  │  │  │  └─ audio-preload.ts
│  │  │  ├─ sw/             # Custom service worker entry for Workbox injection
│  │  │  └─ test/           # Component/unit specs (Vitest)
│  │  └─ tests/
│  │     ├─ e2e/            # Playwright specs + fixtures
│  │     └─ fixtures/
│  └─ infra/
│     └─ supabase/          # CLI config, migrations, seeds
├─ scripts/                 # CI helpers, audio ingestion, build scripts
├─ supabase/                # (Supabase CLI default when initialized)
├─ package.json             # Workspaces + shared scripts
├─ pnpm-workspace.yaml      # Workspace declarations (if pnpm)
└─ turbo.json               # Optional task runner (future)
```

## 4. Step-by-Step Scaffolding Guide

### Step 0 — Prerequisites
1. Install Node.js ≥ 20.11 (needed for Vite 7, Vitest 2, Playwright latest).
2. Choose package manager (recommend `pnpm` ≥ 9 for workspace and disk efficiency).
3. Ensure Supabase CLI ≥ 1.154 is available (`brew install supabase/tap/supabase` or official installer).
4. Confirm FFmpeg (for audio normalization scripts) and sox (optional) are installed; these will be used when populating recorded cues.

### Step 1 — Initialize Monorepo Scaffolding
- Create workspace manifest:
  ```sh
  pnpm init -y
  ```
- Convert to workspace by adding `pnpm-workspace.yaml` with:
  ```yaml
  packages:
    - packages/*
  ```
- Add root `package.json` fields:
  ```json
  {
    "name": "slow-burn",
    "private": true,
    "packageManager": "pnpm@9.x",
    "workspaces": ["packages/*"],
    "scripts": {
      "lint": "pnpm -r lint",
      "test": "pnpm -r test",
      "check": "pnpm lint && pnpm test"
    }
  }
  ```

### Step 2 — Scaffold the React PWA app
- Use the Vite React-TS template with SWC:
  ```sh
  pnpm create vite@latest packages/app -- --template react-swc-ts
  ```
  (command per Vite guide [Context7:/vitejs/vite]).
- Remove sample files (`counter.tsx`, etc.) to start from a clean shell.
- Update `tsconfig.json` to add path aliases (`@/`) and enable `strict: true`.
- Ensure `vite.config.ts` includes `defineConfig` with `plugins: [react()]` and plan to extend with Workbox build steps later.

### Step 3 — Core App Wiring
- Create `src/app/providers.tsx` to register `QueryClientProvider`, suspense boundaries, and event bus context.
  ```tsx
  // QueryClient usage aligns with TanStack guidance [Context7:/tanstack/query]
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
  ```
- Stub top-level routes (`Home`, `Practice`, `Workout`) with placeholder screens; consider React Router later if truly needed, otherwise maintain manual view state to keep surface area narrow.
- Establish `src/services/event-bus` with typed channels and domain events to match the specs.

### Step 4 — State & Data Layers
- Install later (not yet): `@tanstack/react-query`, `@tanstack/query-devtools`, `zustand` (optional). Plan selectors per Zustand docs for slices ([Context7:/websites/zustand_pmnd_rs]).
- Draft `src/services/supabase/client.ts` for Supabase browser client initialization, pulling anon key + URL from environment.
- Define domain models and runtime validators (e.g., `zod`) for events, storage payloads, and Supabase tables.

### Step 5 — Workers & Off-main-thread Assets
- Under `src/workers`, create `pose-worker.ts` following the contract from spec; configure Vite to treat it as a separate entry using `new Worker(new URL('./workers/pose-worker.ts', import.meta.url), { type: 'module' })`.
- Add helper `audio-preload.ts` worker for warming audio buffers before sessions.
- Ensure `tsconfig.worker.json` extends base config with `lib: ["WebWorker", "WebWorker.ImportScripts", "ES2023"]` to keep types accurate.

### Step 6 — Service Worker & Workbox Integration
- Add `src/sw/entry.ts` as Workbox entry point using `precacheAndRoute(self.__WB_MANIFEST)` and custom runtime routes (reference API signature [Context7:/googlechrome/workbox]).
- Plan to integrate `workbox-build` in a Vite plugin or post-build script to inject precache manifest for audio/model assets without shipping entire `public/` folder unversioned.
- Document autoplay fallback logic in voice driver (per spec) with feature detection and dev-only SpeechSynthesis fallback.

### Step 7 — Supabase Project Setup
- Initialize local project (`supabase init`) once Supabase CLI is ready ([Context7:/supabase/supabase]). This creates `/supabase` metadata; mirror it into `docs/04_platform` if needed.
- Under `supabase/migrations`, create timestamped SQL migrations for the `workout_sessions`, `workout_sets`, and `companion_state` tables defined in architecture doc.
- Add `scripts/dev-db-up.sh` to run `supabase start` when we begin local stack (guide snippet [Context7:/supabase/supabase]).

### Step 8 — Testing & QA Scaffolding
- Configure Vitest via `vitest.config.ts` with DOM environment and global test setup ([Context7:/vitest-dev/vitest]).
- Add `src/test/setup.ts` to register `@testing-library/jest-dom` matchers.
- Create Playwright config in `packages/app/tests/e2e/playwright.config.ts`; include mobile viewports and service worker enablement. Install instructions reference `@playwright/test` usage ([Context7:/microsoft/playwright]).
- Add root scripts:
  ```json
  {
    "scripts": {
      "test:unit": "pnpm --filter app vitest",
      "test:e2e": "pnpm --filter app playwright test"
    }
  }
  ```

### Step 9 — Audio & Asset Pipeline
- Define naming convention in `packages/app/public/audio/README.md` (e.g., `phase__language__voice__variant.mp3`).
- Include script placeholder in `scripts/ingest-audio.ts` to copy mastered MP3/WAV files into `public/audio` and update manifest.
- Plan Workbox precache include/exclude for audio to avoid repeated network hits.

### Step 10 — CI/CD & Tooling Hooks
- Add `.github/workflows/ci.yml` (later) running lint, vitest, playwright (under `--ui false`).
- Consider Turborepo or `pnpm recursive` for caching once tasks exist.
- Document environment variables required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VOICE_CDN_BASE` (for remote audio later), etc.

## 5. Post-Scaffold Next Actions
1. Implement the workout engine reducer and event bus wiring per spec before touching pose logic.
2. Populate the recorded audio set (MVP) and wire Workbox precache manifest.
3. Add Supabase migrations + type-safe client wrappers (e.g., `supabase/tsconfig.json` + typegen).
4. Introduce development SpeechSynthesis fallback behind feature flag for quick iteration.
5. Wire CI to run `pnpm test` and `pnpm test:e2e --project=chromium` on pull requests.

Once these steps are followed, we will have a concrete scaffolding ready for Codex-driven implementation while keeping scope aligned with the MVP architecture.
