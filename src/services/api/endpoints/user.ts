/**
 * User/Auth API endpoints
 */

import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/config';
import type { Profiles, ProfilesUpdate } from '@/types/api.types.gen';

// Type aliases for cleaner code
type Profile = Profiles;
type ProfileUpdate = ProfilesUpdate;

/**
 * User API service
 */
export const userApi = {
  /**
   * Get current user profile
   *
   * @returns User profile data
   */
  async getProfile(): Promise<Profile> {
    return apiClient.get<Profile>(ENDPOINTS.AUTH.ME);
  },

  /**
   * Update user profile
   *
   * @param data - Partial user profile data to update
   * @returns Updated user profile
   */
  async updateProfile(data: ProfileUpdate): Promise<Profile> {
    return apiClient.patch<Profile>(ENDPOINTS.AUTH.ME, data);
  },
};
