import { buttons, typography } from "@/app/theme";

import type { ScreenProps } from "./types";

export function HomeScreen({ onNavigate }: ScreenProps) {
  return (
    <div className="space-y-5">
      <h2 className={typography.heading}>Ready to slow burn</h2>
      <p className={typography.body}>
        Kick things off by jumping into a guided workout or drill-focused
        practice session. Everything runs offline-first with on-device pose
        tracking.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          className={buttons.primary}
          onClick={() => onNavigate("workout")}
        >
          Start Workout
        </button>
        <button
          type="button"
          className={buttons.ghost}
          onClick={() => onNavigate("practice")}
        >
          Practice Reps
        </button>
      </div>
    </div>
  );
}

export default HomeScreen;
