/**
 * Toast notifications for plan-related operations
 *
 * Sprint 3 MVP Implementation - Provides consistent user feedback for plan CRUD operations
 * Following the same pattern as authToast for consistency
 */

import type { components } from '@/lib/api';
import { toast } from '@/lib/toast';

import { planHelpers } from './planHelpers';

// Use the generated OpenAPI type
type Plan = components['schemas']['PlanResponseModel'];

/**
 * Plan-specific toast notifications
 */
export const planToast = {
  /**
   * Success toast for plan creation
   */
  createSuccess: (plan: Plan) => {
    toast.success('Plan created successfully!', {
      description: `"${plan.name}" has been added to your plans.`,
    });
  },

  /**
   * Success toast for plan update
   */
  updateSuccess: (plan: Plan) => {
    toast.success('Plan updated successfully!', {
      description: `"${plan.name}" has been updated.`,
    });
  },

  /**
   * Success toast for plan deletion
   */
  deleteSuccess: (planName?: string) => {
    toast.success('Plan deleted successfully!', {
      description: planName ? `"${planName}" has been removed from your plans.` : undefined,
    });
  },

  /**
   * Error toast for plan creation failure
   */
  createError: (error?: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to create plan';
    toast.error(message, {
      description: 'Please check your input and try again.',
    });
  },

  /**
   * Error toast for plan update failure
   */
  updateError: (error?: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to update plan';
    toast.error(message, {
      description: 'Please check your input and try again.',
    });
  },

  /**
   * Error toast for plan deletion failure
   */
  deleteError: (error?: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to delete plan';
    toast.error(message, {
      description: 'The plan may be in use or you may not have permission.',
    });
  },

  /**
   * Error toast for plan fetch failure
   */
  fetchError: (error?: unknown) => {
    const message = error instanceof Error ? error.message : 'Failed to load plans';
    toast.error(message, {
      description: 'Please check your connection and try again.',
    });
  },

  /**
   * Info toast for empty plans list
   */
  noPlanFound: () => {
    toast.info('No workout plans yet', {
      description: 'Create your first plan to get started!',
    });
  },

  /**
   * Warning toast for validation errors
   */
  validationError: (field: 'name' | 'description', issue: string) => {
    const fieldLabels = {
      name: 'Plan name',
      description: 'Description',
    };

    toast.warning(`${fieldLabels[field]} ${issue}`, {
      description: 'Please correct the issue and try again.',
    });
  },

  /**
   * Info toast for plan features coming soon
   */
  featureComingSoon: (feature: string) => {
    toast.info('Coming soon!', {
      description: `${feature} will be available in a future update.`,
    });
  },

  /**
   * Success toast for plan duplication (future feature)
   */
  duplicateSuccess: (originalName: string, newName: string) => {
    toast.success('Plan duplicated!', {
      description: `"${originalName}" has been copied as "${newName}".`,
    });
  },

  /**
   * Loading toast for long operations
   */
  loading: (message = 'Processing your plan...') => {
    return toast.loading(message);
  },

  /**
   * Helper to show validation errors for plan fields
   */
  showValidationErrors: (errors: Partial<Record<keyof Plan, string>>) => {
    // Show first error as main message
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error('Please fix the following issues:', {
        description: firstError,
      });
    }
  },

  /**
   * Helper to validate and show errors for plan name
   */
  validateName: (name: string): boolean => {
    if (!planHelpers.isValidPlanName(name)) {
      if (name.length === 0) {
        planToast.validationError('name', 'is required');
      } else if (name.length > 100) {
        planToast.validationError('name', 'must be 100 characters or less');
      }
      return false;
    }
    return true;
  },

  /**
   * Helper to validate and show errors for plan description
   */
  validateDescription: (description: string): boolean => {
    if (!planHelpers.isValidDescription(description)) {
      planToast.validationError('description', 'must be 2000 characters or less');
      return false;
    }
    return true;
  },
};
