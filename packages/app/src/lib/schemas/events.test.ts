import { describe, expect, it } from "vitest";

import { domainEventSchema } from "./events";

describe("domainEventSchema", () => {
  it("accepts a valid workout start event", () => {
    const event = {
      type: "WORKOUT_START" as const,
      source: "ui" as const,
      ts: 0,
      seq: 0,
      mode: "circuit" as const,
      workoutId: "circuit-1",
    };

    expect(() => domainEventSchema.parse(event)).not.toThrow();
  });

  it("rejects countdown ticks outside the allowed window", () => {
    const invalidEvent = {
      type: "COUNTDOWN_TICK" as const,
      source: "timer" as const,
      ts: 120,
      seq: 3,
      seconds_left: 4,
    };

    expect(() => domainEventSchema.parse(invalidEvent)).toThrow();
  });

  it("guards rep events to squats only", () => {
    const invalidEvent = {
      type: "REP_COMPLETE" as const,
      source: "worker" as const,
      ts: 420,
      seq: 9,
      exercise: "burpee",
      confidence: 0.8,
    };

    expect(() => domainEventSchema.parse(invalidEvent)).toThrow();
  });
});
