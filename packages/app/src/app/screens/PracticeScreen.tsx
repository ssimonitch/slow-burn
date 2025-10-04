import { buttons, typography } from '@/app/theme';
import { PracticeHarness } from '@/features/workout-engine';

import type { ScreenProps } from './types';

export function PracticeScreen({ onNavigate }: ScreenProps) {
  return (
    <div className="space-y-5">
      <h2 className={typography.heading}>Practice reps in isolation</h2>
      <p className={typography.body}>
        Drill down on a single movement with rep counting audio cues, pose confidence indicators, and event logging to
        feed your progress summary.
      </p>
      <button type="button" className={buttons.ghost} onClick={() => onNavigate('home')}>
        Back to Home
      </button>
      <div className="w-full rounded-lg border border-slate-800 bg-slate-950/30 p-4 text-left">
        <PracticeHarness />
      </div>
    </div>
  );
}

export default PracticeScreen;
