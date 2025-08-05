/**
 * Workout Plans API endpoints
 */

import { apiClient } from '@/services/api/client';
import { ENDPOINTS, PAGINATION } from '@/services/api/config';
import type { PaginatedResponse, QueryParams } from '@/services/api/types';
import type { Exercises, PlanExercises, Plans } from '@/types/api.types.gen';

// Type aliases for cleaner code
type Plan = Plans;
type PlanExercise = PlanExercises;
type Exercise = Exercises;

/**
 * Plan with exercises populated
 */
export interface PlanWithExercises extends Plan {
  exercises?: (PlanExercise & {
    exercise?: Exercise;
  })[];
}

/**
 * Plan creation data
 * Maps frontend data to database insert format
 */
export interface CreatePlanData {
  name: string;
  description?: string;
  difficulty_level?: string;
  duration_weeks?: number;
  days_per_week?: number;
  is_public?: boolean;
  goal?: string;
  exercises?: {
    exercise_id: string;
    day_of_week: number;
    order_in_day: number;
    sets: number;
    target_reps: number[];
    rest_seconds?: number;
    notes?: string;
  }[];
}

/**
 * Plan update data
 * Partial update following database schema
 */
export type UpdatePlanData = Partial<CreatePlanData>;

/**
 * Plan query parameters
 */
export interface PlanQueryParams extends QueryParams {
  is_public?: boolean;
  difficulty_level?: string;
  user_id?: string;
  is_active?: boolean;
}

/**
 * Plans API service
 */
export const plansApi = {
  /**
   * Get paginated list of plans
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated plan list
   */
  async list(params?: PlanQueryParams): Promise<PaginatedResponse<Plan>> {
    const queryParams = {
      page: params?.page ?? 1,
      limit: params?.limit ?? PAGINATION.DEFAULT_LIMIT,
      ...params,
    };

    return apiClient.get<PaginatedResponse<Plan>>(ENDPOINTS.PLANS.LIST, queryParams);
  },

  /**
   * Get plan by ID
   *
   * @param id - Plan ID
   * @returns Plan details with exercises
   */
  async get(id: string): Promise<PlanWithExercises> {
    return apiClient.get<PlanWithExercises>(ENDPOINTS.PLANS.GET(id));
  },

  /**
   * Create a new plan
   *
   * @param data - Plan creation data
   * @returns Created plan
   */
  async create(data: CreatePlanData): Promise<Plan> {
    return apiClient.post<Plan>(ENDPOINTS.PLANS.CREATE, data);
  },

  /**
   * Update a plan (creates new version)
   *
   * @param id - Plan ID to update
   * @param data - Plan update data
   * @returns New plan version
   */
  async update(id: string, data: UpdatePlanData): Promise<Plan> {
    return apiClient.put<Plan>(ENDPOINTS.PLANS.UPDATE(id), data);
  },

  /**
   * Delete a plan
   *
   * @param id - Plan ID to delete
   */
  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(ENDPOINTS.PLANS.DELETE(id));
  },
};
