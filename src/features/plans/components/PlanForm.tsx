/**
 * Plan Form Component
 *
 * Sprint 3 MVP Implementation - Minimal form with 4 essential fields
 * Follows the same patterns as LoginForm and SignupForm from Sprint 2
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { components } from '@/lib/api';

import {
  defaultPlanFormValues,
  DIFFICULTY_LEVELS,
  NOT_SPECIFIED_SENTINEL,
  planFormSchema,
  type PlanFormValues,
  planToFormValues,
  TRAINING_STYLES,
} from '../schemas/plan.schema';
import { planHelpers } from '../utils/planHelpers';

// Use the generated OpenAPI types
type Plan = components['schemas']['PlanResponseModel'];
type CreatePlanData = components['schemas']['PlanCreateModel'];
type UpdatePlanData = components['schemas']['PlanUpdateModel'];

interface PlanFormProps {
  /**
   * Optional plan to edit. If provided, form operates in edit mode.
   */
  plan?: Plan;

  /**
   * Callback when form is successfully submitted
   */
  onSuccess?: (plan: Plan) => void;

  /**
   * Callback when form is cancelled
   */
  onCancel?: () => void;

  /**
   * Submit handler - parent component provides the API call
   * Returns the created/updated plan on success
   */
  onSubmit: (data: CreatePlanData | UpdatePlanData) => Promise<Plan>;

  /**
   * Whether the form is currently submitting
   * Allows parent to control loading state
   */
  isSubmitting?: boolean;

  /**
   * Error from parent component
   */
  error?: Error | null;
}

/**
 * Reusable plan form component for create and edit modes
 *
 * Features:
 * - 4 essential fields: name, training_style, description, difficulty_level
 * - Validation with Zod schema matching backend requirements
 * - Loading states and error handling
 * - Mobile-responsive design with large touch targets
 * - Follows Sprint 2 form patterns for consistency
 */
export const PlanForm: React.FC<PlanFormProps> = ({
  plan,
  onSuccess,
  onCancel,
  onSubmit,
  isSubmitting = false,
  error,
}) => {
  const isEditMode = !!plan;
  const [localSubmitting, setLocalSubmitting] = useState(false);

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: plan ? planToFormValues(plan) : defaultPlanFormValues,
  });

  const handleSubmit = async (values: PlanFormValues) => {
    setLocalSubmitting(true);

    try {
      // Prepare data for API - remove undefined values for cleaner payload
      const data: CreatePlanData | UpdatePlanData = {
        name: values.name,
        training_style: values.training_style,
        ...(values.description && { description: values.description }),
      };

      // Check if difficulty_level has a real value (not the sentinel)
      if (values.difficulty_level && values.difficulty_level !== NOT_SPECIFIED_SENTINEL) {
        data.difficulty_level = values.difficulty_level;
      }

      // For create payloads, ensure is_public is explicitly set to false if not provided by parent
      let result: Plan;
      if (!isEditMode) {
        const createData = data as CreatePlanData;
        const payload: CreatePlanData = {
          ...createData,
          is_public: createData.is_public ?? false,
        };
        result = await onSubmit(payload);
      } else {
        result = await onSubmit(data);
      }
      onSuccess?.(result);
    } catch {
      // Error is handled by parent component
    } finally {
      setLocalSubmitting(false);
    }
  };

  const isLoading = isSubmitting || localSubmitting;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">
          {isEditMode ? 'Edit Workout Plan' : 'Create New Workout Plan'}
        </CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Update your workout plan details. Changes will create a new version.'
            : 'Start with the basics. You can add exercises later.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)} className="space-y-6">
            {/* Plan Name - Required */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Upper/Lower Split, PPL Routine"
                      disabled={isLoading}
                      className="h-11"
                      aria-label="Plan name"
                      maxLength={100}
                    />
                  </FormControl>
                  <FormDescription>Give your plan a clear, memorable name (max 100 characters)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Training Style - Required */}
            <FormField
              control={form.control}
              name="training_style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Training Style *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger className="h-11" aria-label="Training style">
                        <SelectValue placeholder="Select a training style" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(TRAINING_STYLES).map(([, value]) => (
                        <SelectItem key={value} value={value} className="min-h-[44px] cursor-pointer">
                          {planHelpers.getTrainingStyleLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Choose the style that best matches your training goals</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Difficulty Level - Optional */}
            <FormField
              control={form.control}
              name="difficulty_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty Level</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? NOT_SPECIFIED_SENTINEL}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11" aria-label="Difficulty level">
                        <SelectValue placeholder="Select difficulty (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem
                        value={NOT_SPECIFIED_SENTINEL}
                        className="text-muted-foreground min-h-[44px] cursor-pointer"
                      >
                        Not specified
                      </SelectItem>
                      {Object.entries(DIFFICULTY_LEVELS).map(([, value]) => (
                        <SelectItem key={value} value={value} className="min-h-[44px] cursor-pointer">
                          {planHelpers.getDifficultyLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Help others understand who this plan is designed for</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description - Optional */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe your plan's goals, structure, or any special notes..."
                      disabled={isLoading}
                      className="min-h-[100px] resize-y"
                      aria-label="Plan description"
                      maxLength={2000}
                    />
                  </FormControl>
                  <FormDescription>Optional details about your plan (max 2000 characters)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Display */}
            {error && (
              <div
                className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error.message || 'An error occurred. Please try again.'}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="h-11 w-full sm:w-auto"
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isLoading} size="lg" className="h-11 w-full sm:w-auto sm:min-w-[120px]">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : isEditMode ? (
                  'Update Plan'
                ) : (
                  'Create Plan'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>

      {!isEditMode && (
        <CardFooter className="border-t pt-6">
          <p className="text-muted-foreground text-sm">
            <strong>Tip:</strong> Start simple with just a name and training style. You can always edit your plan later
            to add more details.
          </p>
        </CardFooter>
      )}
    </Card>
  );
};
