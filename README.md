# Slow Burn Frontend

React + TypeScript frontend for the Slow Burn AI Fitness Companion - a Progressive Web App (PWA) that helps users track workouts while building a relationship with an AI companion.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test
```

## Development Commands

```bash
pnpm dev          # Start dev server (port 5173)
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
pnpm typecheck    # Check TypeScript types
pnpm test         # Run unit tests
pnpm test:watch   # Run tests in watch mode
pnpm test:integration  # Run integration tests (requires local Supabase)
pnpm test:all     # Run all tests
```

## Tech Stack

- **Framework**: React 19+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Authentication**: Supabase (client-side)
- **Testing**: Vitest + React Testing Library
- **PWA**: Vite PWA Plugin

## Project Structure

```
src/
├── components/     # Reusable UI components
├── features/       # Feature-based modules
├── services/       # API clients and services
├── pages/         # Route-level components
├── hooks/         # Custom React hooks
├── lib/           # Utilities and helpers
├── stores/        # Zustand state stores
└── types/         # TypeScript type definitions
```

## Testing

We use a hybrid testing approach:

- **Unit Tests** (`.unit.test.ts`): Test business logic with mocked dependencies
- **Integration Tests** (`.integration.test.ts`): Test against real services

See [Testing Strategy](./docs/testing-strategy.md) for detailed testing guidelines.

### Running Tests

```bash
# Unit tests only
pnpm test

# Integration tests (requires local Supabase)
pnpm test:integration

# All tests
pnpm test:all
```

## Environment Setup

Create a `.env.local` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend API (optional)
VITE_BACKEND_URL=http://localhost:8000
```

## Local Development with Supabase

For integration testing and local development:

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Stop when done
supabase stop
```

## Code Quality

- **ESLint**: Configured with strict TypeScript rules
- **Prettier**: Auto-formatting on save
- **Husky**: Pre-commit hooks for linting
- **TypeScript**: Strict mode enabled

## Architecture Decisions

- **Frontend-Direct Auth**: Authentication handled directly with Supabase client SDK
- **Feature-Based Organization**: Code organized by features rather than file types
- **Type Safety**: Comprehensive TypeScript usage with Zod runtime validation
- **Error Handling**: Centralized error reporting system ready for Sentry integration

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure tests pass: `pnpm test:all`
4. Ensure linting passes: `pnpm lint`
5. Submit a pull request

## Resources

- [Project Documentation](./docs/)
- [Backend Integration Guide](./docs/01_backend_integration_context.md)
- [Testing Strategy](./docs/testing-strategy.md)
- [Sprint Planning](./docs/planning/)
