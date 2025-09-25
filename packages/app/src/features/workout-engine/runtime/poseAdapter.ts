import type { EventBus } from '@/services/event-bus/eventBus';
import type { PoseAdapterCommand } from '@/services/event-bus';

const DEFAULT_FAKE_INTERVAL_MS = 1200;

export function initializePoseAdapter(bus: EventBus) {
  let fakeInterval: ReturnType<typeof setInterval> | null = null;

  const emitFakeRep = () => {
    bus.emit('pose:event', {
      type: 'REP_COMPLETE',
      exercise: 'squat',
      confidence: 1,
      ts: performance.now(),
    });
  };

  const stopStream = () => {
    if (fakeInterval != null) {
      clearInterval(fakeInterval);
      fakeInterval = null;
      bus.emit('debug:log', {
        message: 'Pose adapter: stopped fake stream',
        ts: performance.now(),
        source: 'pose-adapter',
      });
    }
  };

  const startStream = (intervalMs: number) => {
    stopStream();
    fakeInterval = setInterval(emitFakeRep, intervalMs);
    bus.emit('debug:log', {
      message: `Pose adapter: started fake stream (${intervalMs}ms)`,
      ts: performance.now(),
      source: 'pose-adapter',
    });
  };

  const unsubscribe = bus.subscribe('pose:command', (command: PoseAdapterCommand) => {
    switch (command.type) {
      case 'FAKE_REP':
        emitFakeRep();
        break;
      case 'FAKE_STREAM_START':
        startStream(command.intervalMs ?? DEFAULT_FAKE_INTERVAL_MS);
        break;
      case 'FAKE_STREAM_STOP':
        stopStream();
        break;
      default:
        break;
    }
  });

  return () => {
    stopStream();
    unsubscribe();
  };
}

export default initializePoseAdapter;
