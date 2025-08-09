/**
 * Plan validation schemas
 *
 * Sprint 3 MVP Implementation - Minimal 4-field validation matching backend requirements
 */

import { z } from 'zod';

import type { components } from '@/lib/api';

// Use generated OpenAPI types
type TrainingStyle = components['schemas']['TrainingStyle'];
type DifficultyLevel = components['schemas']['DifficultyLevel'];

// Training style enum - matches backend exactly
export const TRAINING_STYLES = {
  POWERLIFTING: 'powerlifting',
  BODYBUILDING: 'bodybuilding',
  POWERBUILDING: 'powerbuilding',
  GENERAL_FITNESS: 'general_fitness',
  ATHLETIC_PERFORMANCE: 'athletic_performance',
} as const;

// Difficulty level enum - matches backend exactly
export const DIFFICULTY_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const;

// Export the types too
export type { DifficultyLevel, TrainingStyle };

/**
 * Sentinel value for "not specified" options in Select components
 * Radix UI doesn't allow empty string values, so we use this sentinel
 * which gets transformed to undefined when submitting to the API
 */
export const NOT_SPECIFIED_SENTINEL = '__not_specified__' as const;

/**
 * Schema for plan creation/update forms
 *
 * Backend validation requirements:
 * - name: Required, 1-100 characters
 * - training_style: Required, must be one of the enum values
 * - description: Optional, max 2000 characters
 * - difficulty_level: Optional, must be one of the enum values if provided
 */
export const planFormSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100, 'Plan name must be 100 characters or less').trim(),

  training_style: z.enum(Object.values(TRAINING_STYLES) as [TrainingStyle, ...TrainingStyle[]]),

  description: z.string().max(2000, 'Description must be 2000 characters or less').optional().or(z.literal('')),

  difficulty_level: z
    .union([
      z.enum(Object.values(DIFFICULTY_LEVELS) as [DifficultyLevel, ...DifficultyLevel[]]),
      z.literal(NOT_SPECIFIED_SENTINEL),
    ])
    .optional(),
});

/**
 * Type inference for form values
 */
export type PlanFormValues = z.infer<typeof planFormSchema>;

// Helper type for difficulty level in form
export type FormDifficultyLevel = PlanFormValues['difficulty_level'];

/**
 * Default values for plan form
 */
export const defaultPlanFormValues: PlanFormValues = {
  name: '',
  training_style: TRAINING_STYLES.GENERAL_FITNESS,
  description: '',
  difficulty_level: NOT_SPECIFIED_SENTINEL,
};

/**
 * Helper to convert API plan data to form values
 * Used when editing existing plans
 */
export const planToFormValues = (plan: {
  name: string;
  training_style: string;
  description: string | null;
  difficulty_level: string | null;
}): PlanFormValues => ({
  name: plan.name,
  training_style: plan.training_style as TrainingStyle,
  description: plan.description ?? '',
  difficulty_level: plan.difficulty_level ? (plan.difficulty_level as DifficultyLevel) : NOT_SPECIFIED_SENTINEL,
});
