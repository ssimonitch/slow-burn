# Agent Orchestration Patterns

This document provides detailed patterns and strategies for coordinating multiple specialized agents to deliver complete, production-ready features. Reference this when handling complex multi-agent workflows.

## Available Specialized Agents

### Development Agents
- **react-architect**: Technical architecture and design decisions for React features, offline capabilities, state management
- **react-ui-builder**: Implementation of React components with shadcn/ui, Tailwind CSS, mobile optimization  
- **react-debugger**: Systematic debugging of React apps, PWA issues, state problems, async errors

### Testing Agents
- **ui-tester**: React Testing Library tests for components, user interactions, accessibility
- **logic-tester**: Vitest tests for business logic, utilities, state management

### Review & Planning Agents
- **code-reviewer**: Security audits, production readiness, TypeScript/React best practices
- **sprint-manager**: Sprint planning, task breakdown, dependency analysis, progress tracking

## Core Orchestration Patterns

### CRITICAL: Always Use Task Tool for Delegation
When orchestrating agents, you MUST use the Task tool to invoke them. Never implement directly - always delegate to specialized agents.

### 1. Sequential Implementation Pattern
For features requiring step-by-step development where each phase depends on the previous:

**Conceptual Flow**:
```
1. react-architect → Design technical approach
2. react-ui-builder → Implement components
3. ui-tester → Write comprehensive tests
4. code-reviewer → Final security audit
```

**Actual Implementation with Task Tool**:
```python
# Step 1: Architecture Design
Task(
  subagent_type="react-architect",
  description="Design offline tracking",
  prompt="Design the technical approach for offline workout tracking. Consider state management, data persistence, and sync strategies. Document in docs/temp/."
)

# Step 2: After architect completes, implementation
Task(
  subagent_type="react-ui-builder", 
  description="Build offline components",
  prompt="Based on the architecture from the previous agent, implement the offline workout tracking components. Focus on core functionality."
)

# Step 3: Testing
Task(
  subagent_type="ui-tester",
  description="Test offline features",
  prompt="Write comprehensive tests for the offline workout tracking components. Test offline scenarios and sync behavior."
)

# Step 4: Security Review
Task(
  subagent_type="code-reviewer",
  description="Security audit",
  prompt="Review the offline tracking implementation for security vulnerabilities and production readiness."
)
```

**When to use**: New features requiring architecture decisions, complex state management, or offline capabilities.

### 2. Parallel Execution Pattern
For independent tasks that can run simultaneously to maximize efficiency:

**Conceptual Flow**:
```
Parallel:
├── react-ui-builder → Component A
├── react-ui-builder → Component B
└── logic-tester → Utility functions
Then:
└── ui-tester → Integration tests
```

**Actual Implementation with Task Tool**:
```python
# Execute ALL in a single message for parallel processing:
Task(
  subagent_type="react-ui-builder",
  description="Build LoginForm",
  prompt="Implement the LoginForm component with email/password validation. Follow project conventions."
)

Task(
  subagent_type="react-ui-builder", 
  description="Build SignupForm",
  prompt="Implement the SignupForm component with registration flow. Follow project conventions."
)

Task(
  subagent_type="logic-tester",
  description="Test auth utilities",
  prompt="Write tests for authentication utility functions."
)

# After all parallel tasks complete:
Task(
  subagent_type="ui-tester",
  description="Integration tests",
  prompt="Write integration tests for LoginForm and SignupForm components, ensuring they work together."
)
```

**When to use**: Multiple independent components or utilities that don't depend on each other.

### 3. Iterative Refinement Pattern
For tasks requiring back-and-forth collaboration until acceptance criteria are met:

**Conceptual Flow**:
```
Loop until AC met:
1. react-ui-builder → Implementation
2. ui-tester → Test and identify issues
3. If issues: return to step 1
4. code-reviewer → Final approval
```

**Actual Implementation with Task Tool**:
```python
# Iteration 1: Initial implementation
Task(
  subagent_type="react-ui-builder",
  description="Build WorkoutTimer",
  prompt="Implement the WorkoutTimer component with start/stop/pause functionality and progress display."
)

# Test the implementation
Task(
  subagent_type="ui-tester",
  description="Test WorkoutTimer",
  prompt="Test the WorkoutTimer component. Report any issues or failing tests."
)

# If issues found, iterate:
Task(
  subagent_type="react-ui-builder",
  description="Fix timer issues",
  prompt="Fix the following issues in WorkoutTimer identified by the tester: [specific issues from tester]"
)

# Re-test after fixes
Task(
  subagent_type="ui-tester",
  description="Verify fixes",
  prompt="Re-test the WorkoutTimer component to verify all issues are resolved."
)

# Once tests pass:
Task(
  subagent_type="code-reviewer",
  description="Final review",
  prompt="Perform final review of WorkoutTimer for production readiness."
)
```

**When to use**: Complex components where tests might reveal implementation issues requiring fixes.

### 4. Debug-Fix-Verify Pattern
For systematic bug resolution:

**Conceptual Flow**:
```
1. react-debugger → Identify root cause
2. react-ui-builder OR logic-tester → Fix implementation
3. ui-tester OR logic-tester → Verify fix
4. code-reviewer → Ensure no regressions
```

**Actual Implementation with Task Tool**:
```python
# Step 1: Debug the issue
Task(
  subagent_type="react-debugger",
  description="Debug sync issue",
  prompt="Investigate why offline workouts aren't syncing to the backend when connection is restored. Document root cause."
)

# Step 2: Fix based on debugger findings
Task(
  subagent_type="react-ui-builder",
  description="Fix sync bug",
  prompt="Fix the offline sync issue identified by debugger: [root cause details]. Update service worker and sync logic."
)

# Step 3: Verify the fix works
Task(
  subagent_type="ui-tester",
  description="Test sync fix",
  prompt="Test that offline workouts now sync correctly. Test various offline/online scenarios."
)

# Step 4: Ensure no regressions
Task(
  subagent_type="code-reviewer",
  description="Review fix",
  prompt="Review the sync bug fix to ensure no regressions or new vulnerabilities were introduced."
)
```

**When to use**: Production bugs, performance issues, or unexpected behavior.

### 5. Sprint Task Completion Pattern
For working through sprint board tasks:

**Conceptual Flow**:
```
For each task:
1. sprint-manager → Review requirements
2. react-architect → Design (if needed)
3. react-ui-builder → Implementation
4. ui-tester + logic-tester → Testing
5. sprint-manager → Update documentation
```

**Actual Implementation with Task Tool**:
```python
# Step 1: Review the task
Task(
  subagent_type="sprint-manager",
  description="Review Task 6",
  prompt="Review Task 6 from Sprint 02 in @docs/planning/sprints/sprint_02_2025-01-27.md. Summarize requirements and acceptance criteria."
)

# Step 2: If complex, design first (optional)
Task(
  subagent_type="react-architect",
  description="Design approach",
  prompt="Design the technical approach for Task 6 based on requirements: [requirements]. Consider existing architecture."
)

# Step 3: Implementation
Task(
  subagent_type="react-ui-builder",
  description="Implement Task 6",
  prompt="Implement Task 6 from Sprint 02. Requirements: [details]. Follow project conventions and document decisions."
)

# Step 4: Testing (can be parallel if independent)
Task(
  subagent_type="ui-tester",
  description="Test UI components",
  prompt="Write tests for Task 6 UI components following @docs/02_test_best_practices.md"
)

Task(
  subagent_type="logic-tester",
  description="Test business logic",
  prompt="Write tests for Task 6 business logic and utilities"
)

# Step 5: Update documentation
Task(
  subagent_type="sprint-manager",
  description="Update sprint docs",
  prompt="Update the sprint documentation to mark Task 6 as complete with notes on implementation."
)
```

**When to use**: Progressing through defined sprint tasks.

## Agent Documentation Requirements

### Documentation Protocol
Each agent MUST create a summary document in `docs/temp/` following this format:

**Filename**: `agent_[YYYYMMDD_HHMMSS]_[agent-name]_[task-brief].md`

**Content Structure**:
```markdown
# Agent Summary: [Agent Name] - [Task]
Date: [YYYY-MM-DD HH:MM:SS]

## Task Overview
[Brief description of what was requested]

## Key Decisions
1. **[Decision]**: [Rationale and trade-offs]
2. **[Decision]**: [Rationale and trade-offs]

## Assumptions Made
- [Assumption 1 and why it was necessary]
- [Assumption 2 and validation approach]

## Implementation Details
- [What was created/modified]
- [Patterns or libraries used]
- [Configuration changes]

## Blockers & Resolutions
- **Blocker**: [Description]
  **Resolution**: [How it was resolved or escalated]

## Handoff Notes
- [What the next agent needs to know]
- [Any pending decisions or clarifications]
- [Test coverage or validation status]

## Quality Validation
- TypeScript: ✅/❌ [details]
- Linting: ✅/❌ [details]
- Tests: ✅/❌ [X/Y passing]
```

### When to Document
- **Always**: After completing any significant work
- **Before Handoff**: Summary must exist before passing to next agent
- **On Escalation**: Document the blocker before alerting user

## Blocker Escalation Protocol

### Critical Blockers (STOP IMMEDIATELY)
These require immediate user intervention:

1. **Security Vulnerabilities**
   ```
   🔴 SECURITY ALERT: [Description]
   Impact: [What could happen]
   Options: [Possible solutions requiring user decision]
   ```

2. **Data Integrity Risks**
   ```
   🔴 DATA RISK: [Description]
   Affected: [What data/systems]
   Recommendation: [Safe path forward]
   ```

3. **Architectural Conflicts**
   ```
   🟡 ARCHITECTURE CONFLICT: [Description]
   Current Design: [What exists]
   Required Change: [What's needed]
   User Decision Needed: [Options]
   ```

### Design Ambiguity Escalation
When requirements are unclear:
```
🟡 CLARIFICATION NEEDED:
Requirement: [What was requested]
Ambiguity: [What's unclear]
Options:
1. [Option A with implications]
2. [Option B with implications]
Recommendation: [If applicable]
```

### Technical Debt Warning
When workarounds would accumulate debt:
```
⚠️ TECHNICAL DEBT WARNING:
Quick Fix: [Workaround description]
Debt Impact: [Future problems this creates]
Proper Solution: [Time/effort required]
User Decision: Proceed with workaround or invest in proper solution?
```

## Context Passing Strategies

### Initial Context for First Agent
```
"[TASK DESCRIPTION]

Please ensure you:
1. Read @CLAUDE.md for project conventions
2. Read @docs/00_project_brief.md for project overview
3. Read @docs/01_backend_integration_context.md for API details
4. Follow standards in @docs/02_test_best_practices.md (for test agents)

Documentation Requirement:
Create summary in docs/temp/agent_[timestamp]_[your-name]_[task].md
Document all decisions, assumptions, and blockers encountered.

Escalation Protocol:
STOP and alert user if encountering security issues, architectural conflicts,
or any workaround that would create technical debt.

[SPECIFIC REQUIREMENTS]

Use latest library versions for any new dependencies.
Ensure all validation passes (typecheck, lint, tests)."
```

### Handoff Context Between Agents
```
"The previous agent (@agent-[NAME]) has completed:
[SUMMARY OF WORK]

Previous agent's documentation: docs/temp/agent_[timestamp]_[name]_[task].md
Key decisions made: [Brief list]

Now please:
[NEXT TASKS]

Create your own summary: docs/temp/agent_[timestamp]_[your-name]_[task].md
Build upon the previous work ensuring compatibility.
Alert if previous decisions conflict with best practices."
```

### Context for Parallel Agents
```
"Working in parallel with other agents on related components.
Your specific task: [COMPONENT/FEATURE]
Ensure your work will integrate with: [OTHER COMPONENTS]

Document in: docs/temp/agent_[timestamp]_[your-name]_[task].md
Note any integration assumptions or requirements for other agents."
```

## Quality Gates

Between every agent handoff, enforce these validations:

### Required Checks
1. **TypeScript**: `pnpm typecheck` - Zero errors
2. **Linting**: `pnpm lint` - All rules pass
3. **Tests**: `pnpm test` - All pass or documented why skipped
4. **Build**: `pnpm build` - Successful compilation

### Forbidden Patterns
- No `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck`
- No `eslint-disable` without explicit justification
- No `any` types without proper type guards
- No skipped tests without documentation

## Error Recovery Patterns

### Test Failure Recovery
```
When: Tests fail after implementation
1. Collect specific failure details from test agent
2. Document failure in docs/temp/
3. Create focused fix requirements
4. Return to implementation agent with fixes
5. Maximum 3 iterations before escalating
6. If still failing: ESCALATE to user with options
```

### TypeScript/Lint Failure Recovery
```
When: Validation fails
1. Identify specific violations
2. Document attempted fixes in docs/temp/
3. Return to responsible agent with requirements
4. Agent must fix without using ignore comments
5. If unfixable without ignore: ESCALATE for architectural guidance
```

### Architecture Conflict Recovery
```
When: Implementation conflicts with design
1. Document the specific conflict in docs/temp/
2. ESCALATE if conflict affects core functionality
3. Return to react-architect for adjustment
4. Cascade changes through all affected agents
5. Update all agent documentation
```

### Performance Issue Recovery
```
When: Component causes performance problems
1. react-debugger identifies bottlenecks
2. Document performance metrics in docs/temp/
3. react-architect proposes optimization
4. If optimization requires major refactor: ESCALATE
5. react-ui-builder implements changes
6. ui-tester verifies functionality preserved
```

### Blocker Escalation Recovery
```
When: Agent encounters a blocker
1. STOP current work immediately
2. Document blocker in docs/temp/
3. Present clear escalation to user
4. Wait for user decision
5. DO NOT implement workarounds without approval
```

## Complex Workflow Examples

### Example 1: Complete Authentication Feature
```
Workflow:
1. @agent-sprint-manager: Break down requirements
2. @agent-react-architect: Design auth architecture
3. Parallel:
   - @agent-react-ui-builder: LoginForm
   - @agent-react-ui-builder: SignupForm
   - @agent-react-ui-builder: AuthLayout
4. @agent-ui-tester: Test all components
5. @agent-logic-tester: Test auth service logic
6. @agent-code-reviewer: Security audit
7. @agent-sprint-manager: Update documentation
```

### Example 2: PWA Offline Sync Implementation
```
Workflow:
1. @agent-react-architect: Design offline strategy
2. @agent-react-ui-builder: Implement service worker
3. @agent-logic-tester: Test sync queue logic
4. @agent-react-ui-builder: Add UI indicators
5. @agent-ui-tester: Test offline scenarios
6. @agent-react-debugger: Verify edge cases
7. @agent-code-reviewer: Validate data integrity
```

### Example 3: Performance Optimization Sprint
```
Workflow:
1. @agent-react-debugger: Profile and identify issues
2. @agent-react-architect: Propose optimizations
3. Parallel fixes:
   - @agent-react-ui-builder: Component optimizations
   - @agent-logic-tester: Algorithm improvements
4. @agent-ui-tester: Verify functionality
5. @agent-react-debugger: Confirm improvements
6. @agent-code-reviewer: Final review
```

## Communication Templates

### Progress Update Template
```
✅ Completed: [AGENT] - [WHAT WAS DONE]
🔄 In Progress: [AGENT] - [CURRENT WORK]
⏳ Next: [AGENT] - [UPCOMING WORK]

Quality Status:
- TypeScript: ✅/❌ [details if failed]
- Linting: ✅/❌ [details if failed]
- Tests: ✅/❌ [X/Y passing]
```

### Handoff Summary Template
```
@agent-[PREVIOUS] has completed:
- [Achievement 1]
- [Achievement 2]
- All validation passing

Handing off to @agent-[NEXT] for:
- [Task 1]
- [Task 2]

Context: [Any special considerations]
```

### Final Summary Template
```
Feature: [NAME] - Complete ✅

Agents Involved:
1. @agent-[NAME]: [Contribution]
2. @agent-[NAME]: [Contribution]

Deliverables:
- [Component/Feature 1]
- [Component/Feature 2]
- [X tests added]

Quality Validation:
- TypeScript: ✅ No errors
- Linting: ✅ All rules pass
- Tests: ✅ X/X passing
- Build: ✅ Successful

[Any notes or follow-up items]
```

## Best Practices

### DO:
- ✅ Use TodoWrite to track multi-agent workflows
- ✅ Run parallel agents when tasks are independent
- ✅ Pass context forward to avoid redundant work
- ✅ Validate quality gates between every handoff
- ✅ Document why specific agents were chosen
- ✅ Plan for failure scenarios
- ✅ Respect agent expertise boundaries

### DON'T:
- ❌ Skip validation between agents
- ❌ Force agents outside their domain
- ❌ Forget to provide context documents
- ❌ Run sequentially when parallel is possible
- ❌ Proceed without clear acceptance criteria
- ❌ Ignore failures or accumulate technical debt
- ❌ Use ignore comments to bypass issues

## When to Use Explicit Orchestration

While basic orchestration happens automatically, explicitly invoke @agent-project-orchestrator for:

1. **Multi-Sprint Planning**: Coordinating work across multiple sprints
2. **Complex Features**: 5+ agents or intricate dependencies
3. **Architecture Overhauls**: System-wide changes requiring careful coordination
4. **Emergency Fixes**: Production issues requiring rapid coordinated response
5. **Cross-Functional Work**: Features touching frontend, testing, and documentation

## Measuring Success

Successful orchestration achieves:
- ✅ All acceptance criteria met
- ✅ Zero TypeScript/lint errors
- ✅ Appropriate test coverage
- ✅ Clean handoffs between agents
- ✅ No technical debt introduced
- ✅ Documentation updated
- ✅ User requirements fulfilled

## Troubleshooting

### Common Issues and Solutions

**Issue**: Agents producing incompatible code
**Solution**: Ensure all agents reference the same context documents and previous work

**Issue**: Validation failures between handoffs
**Solution**: Return to previous agent with specific fix requirements, never use ignore comments

**Issue**: Circular dependencies between agents
**Solution**: Break the cycle by having react-architect redesign the approach

**Issue**: Tests revealing fundamental design flaws
**Solution**: Stop iteration, return to react-architect for redesign

**Issue**: Performance degradation after changes
**Solution**: Invoke react-debugger to profile, then optimize with appropriate agents

Remember: The goal is to leverage each agent's specialized expertise while maintaining code quality and project consistency. When in doubt, add more validation rather than less.