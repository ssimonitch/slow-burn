import type {
  CompanionStateRow,
  CompanionStateUpdate,
  WorkoutSessionInsert,
  WorkoutSessionRow,
  WorkoutSetInsert,
  WorkoutSetRow,
} from '@/lib/schemas/storage';

export type Database = {
  public: {
    Tables: {
      workout_sessions: {
        Row: WorkoutSessionRow;
        Insert: WorkoutSessionInsert;
        Update: Partial<WorkoutSessionInsert>;
        Relationships: [];
      };
      workout_sets: {
        Row: WorkoutSetRow;
        Insert: WorkoutSetInsert;
        Update: Partial<WorkoutSetInsert>;
        Relationships: [];
      };
      companion_state: {
        Row: CompanionStateRow;
        Insert: CompanionStateRow;
        Update: CompanionStateUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
