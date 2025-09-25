# Project Bootstrap Plan — Slow Burn MVP

## 1. Overview
- Goal: stand up the mobile-first HIIT PWA described in the system specs with a minimal but scalable React + Vite codebase, preserving on-device pose, an event-driven core, and high-quality audio.
- Deliverables: baseline repository structure, configuration stubs for workers/service worker, testing harness, Supabase migrations folder, and slots for recorded audio + model assets. No packages are installed yet; this is the blueprint to follow when we are ready to scaffold.

## 2. Recommended Stack (latest stable releases)
- React 19 + TypeScript 5 for the UI shell and component model (hooks, concurrent rendering, stable suspense APIs) ([Context7:/reactjs/react.dev]).
- Vite 7 with the React SWC template for fast dev server, TS-first DX, and straightforward worker bundling ([Context7:/vitejs/vite]).
- Tailwind CSS 4 (CLI + PostCSS plugin) for a utility-first design system that stays performant on mobile and integrates cleanly with Vite ([Context7:/tailwindlabs/tailwindcss.com]).
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
│  │  │  │  ├─ pose.ts
│  │  │  │  └─ audio-preload.ts
│  │  │  ├─ sw/             # Custom service worker entry for Workbox injection
│  │  │  └─ test/           # Component/unit specs (Vitest)
│  │  └─ tests/
│  │     ├─ e2e/            # Playwright specs + fixtures
│  │     └─ fixtures/
│  └─ infra/                # Reserved for non-CLI infrastructure (e.g., Terraform) — optional
├─ scripts/                 # CI helpers, audio ingestion, build scripts
├─ supabase/                # Supabase CLI project (config, migrations, seeds)
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

### Step 1 — Initialize Monorepo Scaffolding ✅
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
      "typecheck": "pnpm -r typecheck",
      "test": "pnpm -r test",
      "format": "pnpm --filter app exec prettier --write .",
      "format:check": "pnpm --filter app exec prettier --check .",
      "check": "pnpm lint && pnpm typecheck && pnpm format:check && pnpm test",
      "prepare": "husky"
    }
  }
  ```

### Step 2 — Scaffold the React PWA app ✅
- Vite React SWC template bootstrapped under `packages/app` with Tailwind 4, path aliases, and strict TS config.
- Sample starter files removed; global stylesheet imports Tailwind.

### Step 3 — Core App Wiring ✅
- `src/app/providers.tsx` registers QueryClient, suspense boundaries, and event bus context.
- Placeholder routes/screens stubbed to support upcoming features.
- Theme utilities centralised for consistent styling.

### Step 4 — State & Data Layers ✅
- TanStack Query, devtools, and Supabase client scaffolding present.
- Domain models/validators seeded; Zustand ready to introduce when needed.

### Step 5 — Workers & Off-main-thread Assets ✅
- `pose-worker` and `audio-preload` workers scaffolded under `src/workers/`.
- `tsconfig.worker.json` updated with `lib: ["WebWorker", "WebWorker.ImportScripts", "ES2023"]`.

### Step 6 — Service Worker & Workbox Integration ✅
- `src/sw/entry.ts` created with Workbox runtime routes.
- [`vite-plugin-pwa`](https://github.com/vite-pwa/vite-plugin-pwa) configured in inject-manifest mode; Workbox dependencies upgraded to 7.3.0.
- Voice autoplay fallback documented in `docs/04_platform/05-worker-integration.md`.

### Step 7 — Supabase Project Setup ✅
- Supabase CLI initialized locally; helper docs at `docs/04_platform/07-supabase-setup.md`.
- Baseline migrations for `workout_sessions`, `workout_sets`, and `companion_state` committed and applied.
- `scripts/dev-db-up.sh` and `pnpm supabase:types` added for local workflow.

### Step 8 — Testing & QA Scaffolding (in progress)
- Vitest configuration and test setup are in place. Deferred tasks:
  - Playwright installation and e2e scaffolding (wait for UI flows).
  - CI wiring for Playwright runs.

### Step 9 — Audio & Asset Pipeline (deferred)
- Pending audio asset drop. To revisit: naming convention README, ingest script, Workbox precache tuning.

### Step 10 — CI/CD & Tooling Hooks (deferred)
- GitHub Actions workflow, caching strategy, and environment variable documentation planned once tests stabilize.

## 5. Post-Scaffold Next Actions
1. Implement the workout engine reducer and event bus wiring per spec before touching pose logic.
2. Populate the recorded audio set (MVP) and wire Workbox precache manifest.
3. Add Supabase migrations + type-safe client wrappers (e.g., `supabase/tsconfig.json` + typegen).
4. Introduce development SpeechSynthesis fallback behind feature flag for quick iteration.
5. Wire CI to run `pnpm test` and `pnpm test:e2e --project=chromium` on pull requests.

Once these steps are followed, we will have a concrete scaffolding ready for Codex-driven implementation while keeping scope aligned with the MVP architecture.
