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

## Development Guidance
- Always reference the project brief in @docs/00_project_brief.md for more context about the project
- When integrating with the backend reference @docs/01_backend_integration_context.md
- When writing or evaluating tests reference @docs/02_test_best_practices.md

## Agent Orchestration

When tasks require multiple specialized capabilities, coordinate the appropriate agents in `.claude/agents/`:
- **Implementation + Testing**: Use react-ui-builder → ui-tester/logic-tester pattern
- **Complex Features**: Start with react-architect for design → implementation → testing → code-reviewer
- **Bug Fixes**: Use react-debugger → appropriate fix agent → verification testing
- **Sprint Tasks**: Leverage sprint-manager for planning and documentation updates

**CRITICAL: How to Invoke Agents**:
When orchestrating multiple agents, ALWAYS use the Task tool to delegate work:
- **Never implement directly** when a specialized agent exists - use Task to invoke them
- **Set subagent_type** to the exact agent name (e.g., "react-ui-builder", "ui-tester")
- **Include full context** in the prompt: requirements, previous work, and documentation paths
- **For parallel work**: Use multiple Task invocations in a single message

Example: `Task(subagent_type="react-ui-builder", prompt="Implement Task 6 from Sprint 02...")`

**Agent Documentation**: Each agent MUST maintain a summary in `docs/temp/agent_[timestamp]_[task].md`:
- Key decisions made and rationale
- Assumptions and trade-offs
- Blockers encountered
- Work completed for handoff

**Escalation Protocol**: Agents MUST stop and alert when encountering:
- Architectural conflicts or design ambiguity
- Missing dependencies or broken integrations  
- Security vulnerabilities or data integrity risks
- Workarounds that would create technical debt
- Any uncertainty requiring user clarification

**Quality Gates**: Always enforce between agent handoffs:
- `pnpm typecheck` - No TypeScript errors
- `pnpm lint` - All ESLint rules pass
- `pnpm test` - Tests pass or are properly documented
- No @ts-ignore or eslint-disable comments allowed

For detailed orchestration patterns, error recovery strategies, and complex multi-agent workflows, 
reference `.claude/orchestration-patterns.md`. For explicit complex orchestration needs, use 
@agent-project-orchestrator.