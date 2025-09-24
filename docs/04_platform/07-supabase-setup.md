# Supabase Setup — Slow Burn

**Updated:** 2025-??-??  
**Scope:** Instructions for initializing the local Supabase stack, keeping client types in sync, and wiring the CLI into the Slow Burn monorepo. No commands in this guide are executed automatically; run them manually when you are ready to develop against the database.

## 1. Prerequisites
- Install the Supabase CLI (≥ 1.154). On macOS: `brew install supabase/tap/supabase` or follow [official instructions](https://supabase.com/docs/guides/cli).
- Ensure Docker is running (required for `supabase start`).
- Login to Supabase once via `supabase login` using either a PAT or browser auth.

## 2. Initialize the Project
From the repository root:
```bash
supabase init
```
This creates:
- `supabase/config.toml`
- `supabase/docker` (local stack definitions)
- `supabase/migrations/` (empty)
- `supabase/seed.sql`

Commit these files after confirming nothing sensitive was generated.

## 3. Local Development Workflow
1. Start the local stack when you need Postgres/Realtime:
   ```bash
   supabase start
   ```
   This launches containers and prints service URLs.
2. To stop and clean up:
   ```bash
   supabase stop
   ```
3. Optional reset (drops volumes/data):
   ```bash
   supabase db reset
   ```

## 4. Database Migrations
- Create a timestamped migration per schema change:
  ```bash
  supabase migration new create_workout_tables
  ```
- Edit the generated SQL under `supabase/migrations/<timestamp>_create_workout_tables.sql` to define `workout_sessions`, `workout_sets`, and `companion_state` per `docs/01_system/10-architecture-overview.md`.
- Apply migrations locally:
  ```bash
  supabase db push
  ```
  (This runs pending migrations against the local stack.)

## 5. Type Generation for TypeScript
Follow Supabase’s TypeScript guide: <https://supabase.com/docs/reference/javascript/installing>

Generate types after running `supabase start` and applying migrations:
```bash
pnpm supabase:types
```
This script wraps:
```bash
supabase gen types typescript --local --schema public > packages/app/src/services/supabase/types.gen.ts
```
Advice:
- Keep generated types committed so the UI can import them via `@/services/supabase/types.gen`.
- Re-run after every migration that alters the schema.

## 6. Environment Variables
When the hosted project is available, capture these in `packages/app/.env.local` (with `VITE_` prefix where needed):
- `SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; keep out of client bundles)

For local development the CLI outputs anon/service keys on `supabase start`; mirror them into `.env.local` so the web app can connect to the local API.

## 7. Scripts & Automation
- Use `scripts/dev-db-up.sh` (see repo) as a convenience wrapper to start the local stack.
- Future CI should include `supabase db reset && supabase db push` to verify migrations apply cleanly.

## 8. Next Steps
- Flesh out initial migrations for MVP tables.
- Add a thin client in `packages/app/src/services/supabase/client.ts` that instantiates `createClient` using env vars.
- Consider seeding reference data (exercises, workouts) via SQL or `supabase/seed.sql`.
