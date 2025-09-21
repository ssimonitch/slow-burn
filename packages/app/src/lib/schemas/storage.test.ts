import { describe, expect, it } from "vitest";

import {
  companionStateUpdateSchema,
  workoutSetInsertSchema,
  workoutSessionInsertSchema,
} from "./storage";

describe("storage schemas", () => {
  it("accepts a valid workout session payload", () => {
    const payload = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      workout_type: "practice" as const,
      total_reps: 42,
      duration_sec: 420,
    };

    expect(() => workoutSessionInsertSchema.parse(payload)).not.toThrow();
  });

  it("rejects workout sets with unsupported reasons", () => {
    const invalidPayload = {
      id: "2d3b6f2a-4c25-4cd8-8f6b-9c5b9a9a9b9c",
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      exercise: "squat" as const,
      target_type: "reps" as const,
      goal_value: null,
      actual_reps: 15,
      duration_sec: 300,
      slot_index: null,
      reason: "unexpected",
    } as const;

    expect(() => workoutSetInsertSchema.parse(invalidPayload)).toThrow();
  });

  it("enforces non-negative affinity updates", () => {
    expect(() =>
      companionStateUpdateSchema.parse({ affinity_xp: -1, level: 1 }),
    ).toThrow();
  });
});
