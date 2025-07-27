# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Preview production build
pnpm preview
```

## Project Architecture

This is a React + TypeScript + Vite frontend for the Slow Burn AI Fitness Companion, built as a Progressive Web App (PWA).

### Core Technologies
- **React 19+** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **Tailwind CSS** with **shadcn/ui** components
- **Zustand** for state management
- **Vitest** for testing with React Testing Library

### Directory Structure
- `src/components/` - Reusable UI components
- `src/features/` - Feature-based modules (e.g., theme management)
- `src/pages/` - Route-level page components
- `src/services/` - API clients and external service integrations
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and helpers

### Key Patterns
1. **Path Aliases**: Use `@/` to import from src directory (e.g., `@/components/Button`)
2. **Feature-Based Organization**: Group related components, hooks, and logic by feature
3. **Theme Support**: Built-in dark/light theme switching via ThemeProvider
4. **Type Safety**: Strict TypeScript configuration with erasable syntax checking

### Testing Strategy
- Unit tests use Vitest with jsdom environment
- Test files should be placed next to the components they test
- Setup file located at `src/test/setup.ts`
- Run specific tests with: `pnpm test path/to/test.spec.ts`

### Pre-commit Hooks
Husky is configured to run linting before commits. Ensure code passes `pnpm lint` and `pnpm typecheck` before committing.