/**
 * Shared plan helper utilities
 *
 * This module provides common utility functions for working with workout plans,
 * consolidating previously duplicated code across multiple components.
 *
 * Functions include:
 * - Label formatting for training styles and difficulty levels
 * - Validation helpers for plan fields
 */

/**
 * Helper functions for working with plans
 * Consolidated from PlanForm, PlanCard, and planToast components
 */
export const planHelpers = {
  /**
   * Get human-readable label for training style
   */
  getTrainingStyleLabel(style: string): string {
    const labels: Record<string, string> = {
      powerlifting: 'Powerlifting',
      bodybuilding: 'Bodybuilding',
      powerbuilding: 'Powerbuilding',
      general_fitness: 'General Fitness',
      athletic_performance: 'Athletic Performance',
    };
    return labels[style] || style;
  },

  /**
   * Get human-readable label for difficulty level
   */
  getDifficultyLabel(level: string | null): string {
    if (!level) return 'Not specified';
    const labels: Record<string, string> = {
      beginner: 'Beginner',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
    };
    return labels[level] || level;
  },

  /**
   * Validate plan name length
   */
  isValidPlanName(name: string): boolean {
    return name.length >= 1 && name.length <= 100;
  },

  /**
   * Validate plan description length
   */
  isValidDescription(description: string): boolean {
    return description.length <= 2000;
  },
};
