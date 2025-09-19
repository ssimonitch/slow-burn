import { buttons, typography } from "@/app/theme";
import { useEventBus } from "@/services/event-bus";

import type { ScreenProps } from "./types";

export function WorkoutScreen({ onNavigate }: ScreenProps) {
  const eventBus = useEventBus();

  const handleStart = () => {
    const workoutId = crypto.randomUUID();
    eventBus.emit("workout:start", { workoutId });
    eventBus.emit("workout:phase-change", {
      phase: "countdown",
      timestamp: performance.now(),
    });
  };

  const handleStop = () => {
    eventBus.emit("workout:stop", { reason: "user" });
    onNavigate("home");
  };

  return (
    <div className="space-y-5">
      <h2 className={typography.heading}>Circuit mode preview</h2>
      <p className={typography.body}>
        This screen will orchestrate countdowns, pose worker integration, and
        the workout engine. Use the buttons below to simulate event bus traffic
        until the real integrations are in place.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" className={buttons.primary} onClick={handleStart}>
          Emit Start + Countdown
        </button>
        <button type="button" className={buttons.ghost} onClick={handleStop}>
          Stop Workout
        </button>
      </div>
    </div>
  );
}

export default WorkoutScreen;
