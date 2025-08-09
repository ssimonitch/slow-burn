/**
 * Plans Page Component
 *
 * Sprint 3 Task 5: Combined page for plan management
 * Integrates all plan-related functionality into a single cohesive page
 *
 * Features:
 * - List view with pagination
 * - Create new plan via dialog
 * - Edit existing plan via dialog
 * - Delete plan with confirmation
 * - Mobile-friendly responsive design
 */

import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlanForm } from '@/features/plans/components/PlanForm';
import { PlansList } from '@/features/plans/components/PlansList';
import { planToast } from '@/features/plans/utils/planToast';
import { $api, type components, useApiCache } from '@/lib/api';

// Use the generated OpenAPI types
type Plan = components['schemas']['PlanResponseModel'];
type CreatePlanData = components['schemas']['PlanCreateModel'];
type UpdatePlanData = components['schemas']['PlanUpdateModel'];

/**
 * Plans management page with CRUD operations
 *
 * Implements a simple single-page interface for managing workout plans.
 * Uses dialog modals for create/edit forms to maintain context while
 * keeping the UI clean and focused.
 */
export function PlansPage() {
  // Dialog state management
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | undefined>();
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

  // API mutations using OpenAPI hooks
  const createPlan = $api.useMutation('post', '/api/v1/plans/');
  const updatePlan = $api.useMutation('put', '/api/v1/plans/{plan_id}');
  const deletePlan = $api.useMutation('delete', '/api/v1/plans/{plan_id}');
  const { invalidatePlans } = useApiCache();

  /**
   * Handle plan creation
   */
  const handleCreate = useCallback(
    async (data: CreatePlanData | UpdatePlanData): Promise<Plan> => {
      // For create, we know it's CreatePlanData
      const result = await createPlan.mutateAsync({
        body: data as CreatePlanData,
      });

      planToast.createSuccess(result);
      setIsCreateDialogOpen(false);
      // Ensure plans list/detail caches are refreshed
      void invalidatePlans();
      return result;
    },
    [createPlan, invalidatePlans],
  );

  /**
   * Handle plan update
   */
  const handleUpdate = useCallback(
    async (data: UpdatePlanData): Promise<Plan> => {
      if (!selectedPlan) {
        throw new Error('No plan selected for update');
      }

      const result = await updatePlan.mutateAsync({
        params: {
          path: { plan_id: selectedPlan.id },
        },
        body: data,
      });

      planToast.updateSuccess(result);
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
      // Refresh plans caches so latest version appears
      void invalidatePlans();
      return result;
    },
    [invalidatePlans, selectedPlan, updatePlan],
  );

  /**
   * Handle edit button click - opens edit dialog
   */
  const handleEditClick = useCallback((plan: Plan) => {
    setSelectedPlan(plan);
    setIsEditDialogOpen(true);
  }, []);

  /**
   * Handle delete button click - opens confirmation dialog
   */
  const handleDeleteClick = useCallback((plan: Plan) => {
    setPlanToDelete(plan);
  }, []);

  /**
   * Handle confirmed delete
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!planToDelete) return;

    setDeletingPlanId(planToDelete.id);
    try {
      await deletePlan.mutateAsync({
        params: {
          path: { plan_id: planToDelete.id },
        },
      });
      planToast.deleteSuccess(planToDelete.name);
      // Invalidate plans caches after successful deletion
      void invalidatePlans();
    } catch (error) {
      // Error will be handled by the mutation hook or shown via toast
      planToast.deleteError(error as Error);
    } finally {
      setDeletingPlanId(undefined);
      setPlanToDelete(null);
    }
  }, [deletePlan, invalidatePlans, planToDelete]);

  /**
   * Handle cancel delete
   */
  const handleCancelDelete = useCallback(() => {
    setPlanToDelete(null);
  }, []);

  /**
   * Handle dialog close/cancel
   */
  const handleCreateCancel = useCallback(() => {
    setIsCreateDialogOpen(false);
  }, []);

  const handleEditCancel = useCallback(() => {
    setIsEditDialogOpen(false);
    setSelectedPlan(null);
  }, []);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workout Plans</h1>
            <p className="text-muted-foreground mt-2">Create and manage your personalized workout plans</p>
          </div>

          {/* Create Plan Button - Large touch target for mobile */}
          <Button size="lg" onClick={() => setIsCreateDialogOpen(true)} className="min-h-[44px] gap-2">
            <Plus className="h-5 w-5" />
            <span>Create Plan</span>
          </Button>
        </div>
      </div>

      {/* Plans List */}
      <PlansList
        onEditPlan={handleEditClick}
        onDeletePlan={(plan) => void handleDeleteClick(plan)}
        deletingPlanId={deletingPlanId}
      />

      {/* Create Plan Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Plan</DialogTitle>
            <DialogDescription>Design a new workout plan tailored to your fitness goals</DialogDescription>
          </DialogHeader>

          <PlanForm
            onSubmit={handleCreate}
            onCancel={handleCreateCancel}
            isSubmitting={createPlan.isPending}
            error={createPlan.error as Error}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>Update your workout plan details</DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <PlanForm
              plan={selectedPlan}
              onSubmit={handleUpdate}
              onCancel={handleEditCancel}
              isSubmitting={updatePlan.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!planToDelete} onOpenChange={handleCancelDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workout Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{planToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingPlanId}
            >
              {deletingPlanId === planToDelete?.id ? 'Deleting...' : 'Delete Plan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
