/**
 * Test factories for plan-related mock data
 *
 * These utilities help create properly typed mock objects for:
 * - Plan objects with sensible defaults
 * - CreatePlanData for form testing
 * - UpdatePlanData for edit form testing
 * - Backend paginated plan responses matching OpenAPI schema
 *
 * All factories use OpenAPI-generated types from @/lib/api for full type safety.
 * All responses follow backend format as the application now works directly with
 * the OpenAPI client without transformation layers.
 *
 * Used across plan component tests to maintain consistency and avoid code duplication.
 */

import { DIFFICULTY_LEVELS, TRAINING_STYLES } from '@/features/plans/schemas/plan.schema';
import type { components } from '@/lib/api';

// Use the generated OpenAPI types
type Plan = components['schemas']['PlanResponseModel'];
type CreatePlanData = components['schemas']['PlanCreateModel'];
type UpdatePlanData = components['schemas']['PlanUpdateModel'];
type PlanListResponse = components['schemas']['PaginatedResponse_PlanResponseModel_'];

/**
 * Creates a mock Plan object with sensible defaults
 * @param overrides - Partial Plan object to override default values
 * @returns Fully typed Plan object
 */
export function createMockPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: overrides.id ?? 'plan-123',
    name: overrides.name ?? 'Push Day Workout',
    description: overrides.description ?? 'Upper body push workout focusing on chest, shoulders, and triceps',
    training_style: overrides.training_style ?? TRAINING_STYLES.POWERBUILDING,
    goal: overrides.goal ?? null,
    difficulty_level: overrides.difficulty_level ?? DIFFICULTY_LEVELS.INTERMEDIATE,
    duration_weeks: overrides.duration_weeks ?? null,
    days_per_week: overrides.days_per_week ?? null,
    is_public: overrides.is_public ?? false,
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

/**
 * Creates a mock CreatePlanData object for form testing
 * @param overrides - Partial CreatePlanData to override default values
 * @returns Fully typed CreatePlanData object
 */
export function createMockCreatePlanData(overrides: Partial<CreatePlanData> = {}): CreatePlanData {
  return {
    name: overrides.name ?? 'New Workout Plan',
    training_style: overrides.training_style ?? TRAINING_STYLES.BODYBUILDING,
    description: overrides.description ?? 'A great workout plan for building muscle',
    goal: overrides.goal ?? null,
    difficulty_level: overrides.difficulty_level ?? DIFFICULTY_LEVELS.BEGINNER,
    duration_weeks: overrides.duration_weeks ?? null,
    days_per_week: overrides.days_per_week ?? null,
    is_public: overrides.is_public ?? false,
    metadata: overrides.metadata ?? {},
    ...overrides,
  };
}

/**
 * Creates a mock UpdatePlanData object for edit form testing
 * @param overrides - Partial UpdatePlanData to override default values
 * @returns Fully typed UpdatePlanData object
 */
export function createMockUpdatePlanData(overrides: Partial<UpdatePlanData> = {}): UpdatePlanData {
  return {
    name: overrides.name ?? 'Updated Plan Name',
    training_style: overrides.training_style ?? TRAINING_STYLES.POWERLIFTING,
    description: overrides.description ?? 'Updated description',
    goal: overrides.goal ?? null,
    difficulty_level: overrides.difficulty_level ?? DIFFICULTY_LEVELS.ADVANCED,
    duration_weeks: overrides.duration_weeks ?? null,
    days_per_week: overrides.days_per_week ?? null,
    is_public: overrides.is_public ?? null,
    metadata: overrides.metadata ?? null,
    ...overrides,
  };
}

/**
 * Creates multiple mock plans for list testing
 * @param count - Number of plans to create
 * @param baseOverrides - Common overrides for all plans
 * @returns Array of Plan objects
 */
export function createMockPlans(count: number, baseOverrides: Partial<Plan> = {}): Plan[] {
  const plans: Plan[] = [];
  const trainingStyles = Object.values(TRAINING_STYLES);
  const difficultyLevels = Object.values(DIFFICULTY_LEVELS);

  for (let i = 0; i < count; i++) {
    plans.push(
      createMockPlan({
        id: `plan-${i + 1}`,
        name: `Workout Plan ${i + 1}`,
        training_style: trainingStyles[i % trainingStyles.length],
        difficulty_level: difficultyLevels[i % difficultyLevels.length],
        created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(), // Days ago
        ...baseOverrides,
      }),
    );
  }

  return plans;
}

/**
 * Creates a paginated response of plans in backend format matching OpenAPI schema
 *
 * Use this when testing:
 * - OpenAPI client response handling
 * - Mock API responses that simulate backend responses
 * - Component tests that work with backend data format
 * - Network layer integration tests
 *
 * @param plans - Array of plans (or count if you want generated plans)
 * @param page - Current page number
 * @param per_page - Items per page (using backend naming convention)
 * @returns PlanListResponse matching OpenAPI schema
 */
export function createMockPlansListResponse(plans: Plan[] | number, page = 1, per_page = 20): PlanListResponse {
  const planArray = typeof plans === 'number' ? createMockPlans(plans) : plans;

  // Simulate pagination by slicing the array
  const startIndex = (page - 1) * per_page;
  const endIndex = startIndex + per_page;
  const paginatedPlans = planArray.slice(startIndex, endIndex);

  return {
    items: paginatedPlans,
    total: planArray.length,
    page,
    per_page,
  };
}

/**
 * Test scenarios for common plan testing patterns
 */
export const planTestScenarios = {
  // Basic plan scenarios
  simplePlan: createMockPlan({
    name: 'Simple Plan',
    description: null,
    difficulty_level: null,
  }),

  detailedPlan: createMockPlan({
    name: 'Advanced Powerlifting Program',
    description: 'A comprehensive 12-week powerlifting program focusing on squat, bench, and deadlift.',
    training_style: TRAINING_STYLES.POWERLIFTING,
    difficulty_level: DIFFICULTY_LEVELS.ADVANCED,
  }),

  longNamePlan: createMockPlan({
    name: 'This is a very long plan name that tests the maximum length allowed by the system validation',
  }),

  longDescriptionPlan: createMockPlan({
    description: 'A'.repeat(1999), // Near max length
  }),

  // Create data scenarios
  minimalCreateData: createMockCreatePlanData({
    name: 'Minimal Plan',
    training_style: TRAINING_STYLES.GENERAL_FITNESS,
    description: undefined,
    difficulty_level: undefined,
  }),

  completeCreateData: createMockCreatePlanData({
    name: 'Complete Plan',
    description: 'Full plan with all fields',
    training_style: TRAINING_STYLES.BODYBUILDING,
    difficulty_level: DIFFICULTY_LEVELS.INTERMEDIATE,
  }),

  // Update data scenarios
  nameOnlyUpdate: createMockUpdatePlanData({
    name: 'Updated Name Only',
    training_style: undefined,
    description: undefined,
    difficulty_level: undefined,
  }),

  // Note: Use createMockPlansListResponse() for paginated response testing
  // All responses match OpenAPI schema for consistent type safety
} as const;
