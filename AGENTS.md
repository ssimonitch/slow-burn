# Repository Guidelines

## Project Structure & Module Organization
- The repository is a pnpm workspace (`pnpm-workspace.yaml`) with the primary React app living in `packages/app`, built with Vite and organised into `src/app`, `src/features`, `src/lib`, `src/services`, and related folders.
- Static assets and the HTML entry point are served from `packages/app/public` and `packages/app/index.html`, both managed by Vite.
- Shared test utilities sit under `packages/app/src/test`, while end-to-end scaffolding belongs in `packages/app/tests` (for example, `tests/e2e` when Playwright specs are added).
- Tooling configuration lives at the repo root and inside `packages/app` (eslint, prettier, Tailwind, tsconfig, vitest, vite).

## Build, Test, and Development Commands
- `pnpm install` – install workspace dependencies from the repository root.
- `pnpm --filter app dev` – start the Vite dev server (defaults to `http://localhost:5173`).
- `pnpm --filter app build` – run TypeScript project builds and emit the Vite production bundle into `packages/app/dist`.
- `pnpm --filter app typecheck` – execute the no-emit TypeScript pass.
- `pnpm --filter app lint` – apply ESLint with the workspace rules; append `--fix` to auto-resolve lint issues when possible.
- `pnpm --filter app --run` – execute Vitest suites.
- `pnpm --filter app preview` – serve the built bundle locally for manual QA.

## Coding Style & Naming Conventions
- TypeScript/React uses 2-space indentation and functional components; prefer running `pnpm --filter app lint --fix` before you commit changes.
- Co-locate UI and logic within feature folders (`src/features/**`) or under `src/app` for shell-level structure, and keep component files in PascalCase that match the exported symbol.
- Use the `@` path alias (rooted at `packages/app/src`) to avoid brittle relative imports.
- Styling depends on Tailwind utility classes; reach for inline styles only when a suitable utility is unavailable.

## Testing Guidelines
- Unit and integration tests run on Vitest with Testing Library; store specs alongside their implementation (`*.test.ts(x)`) or reuse helpers from `src/test`.
- If you introduce service or API mocks, place them under `src/test` so they can be shared between suites.
- Playwright or other end-to-end artefacts belong in `packages/app/tests/e2e`; wire scripts into `package.json` when you enable them for CI.
- Ensure new behaviour includes practical test coverage or document any intentional gaps.

## Agent Tips & Workflow
- Use pnpm workspace commands (`pnpm -r …`) for cross-package tasks, but scope to `app` for day-to-day workflows.
- Vite reads environment variables from `.env*` files inside `packages/app`; prefix client-exposed values with `VITE_` and restart the dev server after edits.
- `src/app/AppShell.tsx` bootstraps the UI. Prefer composing feature-specific screens under `src/features` and keep the shell lean.
- Because TypeScript project references tie tooling together, rerun `pnpm --filter app build` if you modify the TypeScript config files.
