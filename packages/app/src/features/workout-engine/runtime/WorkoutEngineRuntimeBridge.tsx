import { useEffect } from 'react';

import { useEventBus } from '@/services/event-bus';

import { initializeWorkoutEngine } from './runtime';
import { initializePoseAdapter } from './poseAdapter';

export function WorkoutEngineRuntimeBridge() {
  const bus = useEventBus();

  useEffect(() => {
    const disposeEngine = initializeWorkoutEngine(bus);
    const disposePoseAdapter = initializePoseAdapter(bus);

    return () => {
      disposeEngine();
      disposePoseAdapter();
    };
  }, [bus]);

  return null;
}

export default WorkoutEngineRuntimeBridge;
