/**
 * Exercise API endpoints
 */

import { apiClient } from '@/services/api/client';
import { ENDPOINTS, PAGINATION } from '@/services/api/config';
import type { PaginatedResponse, QueryParams } from '@/services/api/types';
import type { EquipmentTypes, ExerciseMuscles, Exercises, MuscleGroups } from '@/types/api.types.gen';

// Type aliases for cleaner code
type Exercise = Exercises;
type ExerciseMuscle = ExerciseMuscles;
type MuscleGroup = MuscleGroups;
type EquipmentType = EquipmentTypes;

/**
 * Exercise with relationships populated
 */
export interface ExerciseWithRelations extends Exercise {
  muscles?: (ExerciseMuscle & {
    muscle_group?: MuscleGroup;
  })[];
  primary_equipment?: EquipmentType;
  secondary_equipment?: EquipmentType;
}

/**
 * Exercise search parameters
 * Maps to database field names
 */
export interface ExerciseSearchParams extends QueryParams {
  query?: string;
  exercise_category?: string;
  primary_equipment_id?: string;
  muscle_group_id?: string;
  difficulty_level?: string;
  force_vector?: string;
  mechanic_type?: string;
  body_region?: string;
}

/**
 * Exercise API service
 */
export const exercisesApi = {
  /**
   * Get paginated list of exercises
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated exercise list
   */
  async list(params?: ExerciseSearchParams): Promise<PaginatedResponse<Exercise>> {
    const queryParams = {
      page: params?.page ?? 1,
      limit: params?.limit ?? PAGINATION.DEFAULT_LIMIT,
      ...params,
    };

    return apiClient.get<PaginatedResponse<Exercise>>(ENDPOINTS.EXERCISES.LIST, queryParams);
  },

  /**
   * Get exercise by ID
   *
   * @param id - Exercise ID
   * @returns Exercise details with relationships
   */
  async get(id: string): Promise<ExerciseWithRelations> {
    return apiClient.get<ExerciseWithRelations>(ENDPOINTS.EXERCISES.GET(id));
  },

  /**
   * Search exercises by query
   *
   * @param query - Search query
   * @param params - Additional search parameters
   * @returns Search results
   */
  async search(query: string, params?: Omit<ExerciseSearchParams, 'query'>): Promise<PaginatedResponse<Exercise>> {
    const searchParams = {
      query,
      page: params?.page ?? 1,
      limit: params?.limit ?? PAGINATION.DEFAULT_LIMIT,
      ...params,
    };

    return apiClient.get<PaginatedResponse<Exercise>>(ENDPOINTS.EXERCISES.SEARCH, searchParams);
  },
};
