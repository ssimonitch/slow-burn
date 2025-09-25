import type { EventBus } from '@/services/event-bus/eventBus';
import { reduceWorkoutEngine, createInitialWorkoutEngineState } from '../core';
import type { EngineExternalSignal } from '../core';

export function initializeWorkoutEngine(bus: EventBus) {
  let state = createInitialWorkoutEngineState();

  const applyResult = (result: ReturnType<typeof reduceWorkoutEngine>) => {
    state = result.state;
    result.events.forEach((event) => {
      bus.emit('engine:event', event);
    });
  };

  const unsubscribeCommand = bus.subscribe('engine:command', (command) => {
    applyResult(reduceWorkoutEngine(state, { kind: 'command', payload: command }));
  });

  const unsubscribePose = bus.subscribe('pose:event', (event) => {
    const signal: EngineExternalSignal = {
      type: 'POSE_EVENT',
      event,
    };
    applyResult(reduceWorkoutEngine(state, { kind: 'signal', payload: signal }));
  });

  return () => {
    unsubscribeCommand();
    unsubscribePose();
  };
}
