export type WorkoutPhase =
  | "idle"
  | "countdown"
  | "active"
  | "rest"
  | "complete";

export type AppEventMap = {
  "workout:start": { workoutId: string };
  "workout:phase-change": { phase: WorkoutPhase; timestamp: number };
  "workout:stop": { reason: "user" | "pose-lost" | "error" };
  "rep:complete": { exercise: string; count: number; timestamp: number };
};

export type AppEventKey = keyof AppEventMap;
export type AppEventPayload<K extends AppEventKey> = AppEventMap[K];

export type AppEventListener<K extends AppEventKey> = (
  payload: AppEventPayload<K>,
) => void;
