# Slow Burn App

React + Vite workspace for the Slow Burn mobile-first PWA. Follow the bootstrap plan in `docs/04_platform/00-bootstrap-plan.md` for setup steps.

## Current Status

- Vite scaffold cleaned and wired with the `@` path alias.
- Tailwind CSS v4 imported via PostCSS (`@tailwindcss/postcss`) with a basic design token baseline.
- ESLint 9 + Prettier 3 configured (with Tailwind class sorting) for consistent linting/formatting.
- App shell stub (`src/app/AppShell.tsx`) ready to host the event-driven UI layers.

Use `pnpm --filter app dev` to start the local dev server once additional features are implemented.
