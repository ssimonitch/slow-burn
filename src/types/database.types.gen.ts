export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      conversations: {
        Row: {
          context: Json | null
          created_at: string | null
          ended_at: string | null
          id: string
          started_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          started_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_types: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      exercise_movement_patterns: {
        Row: {
          created_at: string | null
          exercise_id: string
          id: string
          is_primary: boolean | null
          movement_pattern_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          id?: string
          is_primary?: boolean | null
          movement_pattern_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          id?: string
          is_primary?: boolean | null
          movement_pattern_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_movement_patterns_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_movement_patterns_movement_pattern_id_fkey"
            columns: ["movement_pattern_id"]
            isOneToOne: false
            referencedRelation: "movement_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_muscles: {
        Row: {
          activation_level: number | null
          created_at: string | null
          exercise_id: string
          id: string
          muscle_group_id: string
          muscle_role: string
        }
        Insert: {
          activation_level?: number | null
          created_at?: string | null
          exercise_id: string
          id?: string
          muscle_group_id: string
          muscle_role: string
        }
        Update: {
          activation_level?: number | null
          created_at?: string | null
          exercise_id?: string
          id?: string
          muscle_group_id?: string
          muscle_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscles_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscles_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_relationships: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          parent_exercise_id: string
          related_exercise_id: string
          relationship_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_exercise_id: string
          related_exercise_id: string
          relationship_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          parent_exercise_id?: string
          related_exercise_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_relationships_parent_exercise_id_fkey"
            columns: ["parent_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_relationships_related_exercise_id_fkey"
            columns: ["related_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_training_styles: {
        Row: {
          created_at: string | null
          exercise_id: string
          id: string
          notes: string | null
          optimal_rep_max: number | null
          optimal_rep_min: number | null
          suitability_score: number
          training_style_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
          optimal_rep_max?: number | null
          optimal_rep_min?: number | null
          suitability_score: number
          training_style_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
          optimal_rep_max?: number | null
          optimal_rep_min?: number | null
          suitability_score?: number
          training_style_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_training_styles_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_training_styles_training_style_id_fkey"
            columns: ["training_style_id"]
            isOneToOne: false
            referencedRelation: "training_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          body_region: string | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          exercise_category: string | null
          force_vector: string | null
          id: string
          instructions: string[] | null
          laterality: string | null
          load_type: string | null
          mechanic_type: string | null
          metadata: Json | null
          name: string
          primary_equipment_id: string | null
          secondary_equipment_id: string | null
          tips: string[] | null
          updated_at: string | null
        }
        Insert: {
          body_region?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          exercise_category?: string | null
          force_vector?: string | null
          id?: string
          instructions?: string[] | null
          laterality?: string | null
          load_type?: string | null
          mechanic_type?: string | null
          metadata?: Json | null
          name: string
          primary_equipment_id?: string | null
          secondary_equipment_id?: string | null
          tips?: string[] | null
          updated_at?: string | null
        }
        Update: {
          body_region?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          exercise_category?: string | null
          force_vector?: string | null
          id?: string
          instructions?: string[] | null
          laterality?: string | null
          load_type?: string | null
          mechanic_type?: string | null
          metadata?: Json | null
          name?: string
          primary_equipment_id?: string | null
          secondary_equipment_id?: string | null
          tips?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_primary_equipment_id_fkey"
            columns: ["primary_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_secondary_equipment_id_fkey"
            columns: ["secondary_equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          embedding: unknown | null
          id: string
          importance_score: number | null
          memory_type: string | null
          metadata: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          embedding?: unknown | null
          id?: string
          importance_score?: number | null
          memory_type?: string | null
          metadata?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          embedding?: unknown | null
          id?: string
          importance_score?: number | null
          memory_type?: string | null
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_patterns: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      muscle_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          muscle_region: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          muscle_region: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          muscle_region?: string
          name?: string
        }
        Relationships: []
      }
      plan_exercises: {
        Row: {
          created_at: string | null
          day_of_week: number
          exercise_id: string
          id: string
          notes: string | null
          order_in_day: number
          plan_id: string
          rest_seconds: number | null
          sets: number
          target_reps: number[]
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          exercise_id: string
          id?: string
          notes?: string | null
          order_in_day: number
          plan_id: string
          rest_seconds?: number | null
          sets: number
          target_reps: number[]
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          exercise_id?: string
          id?: string
          notes?: string | null
          order_in_day?: number
          plan_id?: string
          rest_seconds?: number | null
          sets?: number
          target_reps?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_exercises_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          days_per_week: number | null
          deleted_at: string | null
          description: string | null
          difficulty_level: string | null
          duration_weeks: number | null
          goal: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          metadata: Json | null
          name: string
          parent_plan_id: string | null
          training_style: string | null
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          days_per_week?: number | null
          deleted_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          metadata?: Json | null
          name: string
          parent_plan_id?: string | null
          training_style?: string | null
          user_id: string
          version_number?: number
        }
        Update: {
          created_at?: string | null
          days_per_week?: number | null
          deleted_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          metadata?: Json | null
          name?: string
          parent_plan_id?: string | null
          training_style?: string | null
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_parent_plan_id_fkey"
            columns: ["parent_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_training_style_fkey"
            columns: ["training_style"]
            isOneToOne: false
            referencedRelation: "training_styles"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affinity_score: number | null
          age: number | null
          created_at: string | null
          fitness_level: string | null
          full_name: string | null
          goals: string[] | null
          id: string
          preferences: Json | null
          updated_at: string | null
          username: string
        }
        Insert: {
          affinity_score?: number | null
          age?: number | null
          created_at?: string | null
          fitness_level?: string | null
          full_name?: string | null
          goals?: string[] | null
          id: string
          preferences?: Json | null
          updated_at?: string | null
          username: string
        }
        Update: {
          affinity_score?: number | null
          age?: number | null
          created_at?: string | null
          fitness_level?: string | null
          full_name?: string | null
          goals?: string[] | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          assistance_type: string | null
          created_at: string | null
          equipment_variation: string | null
          estimated_1rm: number | null
          exercise_id: string
          failure_type: string | null
          form_quality: number | null
          id: string
          intensity_percentage: number | null
          notes: string | null
          range_of_motion_quality: string | null
          reached_failure: boolean | null
          reps: number
          reps_in_reserve: number | null
          rest_taken_seconds: number | null
          rpe: number | null
          set_number: number
          set_type: string | null
          technique_cues: string[] | null
          tempo: string | null
          updated_at: string | null
          volume_load: number | null
          weight: number | null
          workout_session_id: string
        }
        Insert: {
          assistance_type?: string | null
          created_at?: string | null
          equipment_variation?: string | null
          estimated_1rm?: number | null
          exercise_id: string
          failure_type?: string | null
          form_quality?: number | null
          id?: string
          intensity_percentage?: number | null
          notes?: string | null
          range_of_motion_quality?: string | null
          reached_failure?: boolean | null
          reps: number
          reps_in_reserve?: number | null
          rest_taken_seconds?: number | null
          rpe?: number | null
          set_number: number
          set_type?: string | null
          technique_cues?: string[] | null
          tempo?: string | null
          updated_at?: string | null
          volume_load?: number | null
          weight?: number | null
          workout_session_id: string
        }
        Update: {
          assistance_type?: string | null
          created_at?: string | null
          equipment_variation?: string | null
          estimated_1rm?: number | null
          exercise_id?: string
          failure_type?: string | null
          form_quality?: number | null
          id?: string
          intensity_percentage?: number | null
          notes?: string | null
          range_of_motion_quality?: string | null
          reached_failure?: boolean | null
          reps?: number
          reps_in_reserve?: number | null
          rest_taken_seconds?: number | null
          rpe?: number | null
          set_number?: number
          set_type?: string | null
          technique_cues?: string[] | null
          tempo?: string | null
          updated_at?: string | null
          volume_load?: number | null
          weight?: number | null
          workout_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_styles: {
        Row: {
          created_at: string | null
          description: string | null
          focus_description: string | null
          id: string
          name: string
          rest_periods: string | null
          typical_rep_range: string | null
          typical_set_range: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          focus_description?: string | null
          id?: string
          name: string
          rest_periods?: string | null
          typical_rep_range?: string | null
          typical_set_range?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          focus_description?: string | null
          id?: string
          name?: string
          rest_periods?: string | null
          typical_rep_range?: string | null
          typical_set_range?: string | null
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          mood: string | null
          notes: string | null
          overall_rpe: number | null
          plan_id: string | null
          post_workout_energy: number | null
          pre_workout_energy: number | null
          started_at: string
          total_sets: number | null
          total_volume: number | null
          training_phase: string | null
          updated_at: string | null
          user_id: string
          workout_type: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          mood?: string | null
          notes?: string | null
          overall_rpe?: number | null
          plan_id?: string | null
          post_workout_energy?: number | null
          pre_workout_energy?: number | null
          started_at?: string
          total_sets?: number | null
          total_volume?: number | null
          training_phase?: string | null
          updated_at?: string | null
          user_id: string
          workout_type?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          mood?: string | null
          notes?: string | null
          overall_rpe?: number | null
          plan_id?: string | null
          post_workout_energy?: number | null
          pre_workout_energy?: number | null
          started_at?: string
          total_sets?: number | null
          total_volume?: number | null
          training_phase?: string | null
          updated_at?: string | null
          user_id?: string
          workout_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_affinity_score: {
        Args: { p_user_id: string; p_points?: number }
        Returns: number
      }
      search_memories: {
        Args: {
          p_user_id: string
          p_query_embedding: unknown
          p_limit?: number
          p_threshold?: number
        }
        Returns: {
          id: string
          metadata: Json
          created_at: string
          similarity: number
          importance_score: number
          memory_type: string
          content: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

