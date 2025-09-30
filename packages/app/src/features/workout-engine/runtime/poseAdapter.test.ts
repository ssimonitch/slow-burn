import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import type { AppEventKey, AppEventListener } from '@/services/event-bus';
import type { EventBus } from '@/services/event-bus/eventBus';

import type { PoseAdapterCommand } from '@/services/event-bus';
import type { PoseCamera, PoseCameraFrame } from '@/features/pose';

import { initializePoseAdapter } from './poseAdapter';

class MockBus implements EventBus {
  listeners = new Map<AppEventKey, Set<AppEventListener<AppEventKey>>>();
  private sequence = 0;

  emit<K extends AppEventKey>(key: K, payload: Parameters<AppEventListener<K>>[0]) {
    this.sequence += 1;
    this.listeners.get(key)?.forEach((listener) => listener(payload));
  }

  subscribe<K extends AppEventKey>(key: K, listener: AppEventListener<K>) {
    const set = this.listeners.get(key) ?? new Set();
    set.add(listener as AppEventListener<AppEventKey>);
    this.listeners.set(key, set);

    return () => {
      set.delete(listener as AppEventListener<AppEventKey>);
      if (set.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  getSequence() {
    return this.sequence;
  }
}

describe('pose adapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits REP_COMPLETE for FAKE_REP and stops stream on teardown', () => {
    const bus = new MockBus();
    const events: string[] = [];

    bus.subscribe('pose:event', (event) => {
      events.push(event.type);
    });

    const dispose = initializePoseAdapter(bus);

    bus.emit('pose:command', { type: 'FAKE_REP' });
    expect(events).toEqual(['REP_COMPLETE']);

    bus.emit('pose:command', { type: 'FAKE_STREAM_START', intervalMs: 500 });

    vi.advanceTimersByTime(1200);
    expect(events.filter((type) => type === 'REP_COMPLETE').length).toBeGreaterThanOrEqual(3);

    dispose();
    const lengthAfterDispose = events.length;

    vi.advanceTimersByTime(2000);
    expect(events.length).toBe(lengthAfterDispose);
  });

  it('stops stream when FAKE_STREAM_STOP is emitted', () => {
    const bus = new MockBus();
    let repCount = 0;

    bus.subscribe('pose:event', () => {
      repCount += 1;
    });

    initializePoseAdapter(bus);

    bus.emit('pose:command', { type: 'FAKE_STREAM_START', intervalMs: 200 });
    vi.advanceTimersByTime(600);
    expect(repCount).toBeGreaterThan(0);

    bus.emit('pose:command', { type: 'FAKE_STREAM_STOP' });
    const countAfterStop = repCount;

    vi.advanceTimersByTime(600);
    expect(repCount).toBe(countAfterStop);
  });

  it('starts the pipeline, forwards worker events, and stops cleanly', async () => {
    const bus = new MockBus();
    const events: string[] = [];

    bus.subscribe('pose:event', (event) => {
      events.push(event.type);
    });

    const workerMessages: unknown[] = [];
    const workerListeners: Array<(event: MessageEvent<{ type: string }>) => void> = [];

    const mockWorker = {
      worker: {} as Worker,
      postMessage: vi.fn((message: unknown) => {
        workerMessages.push(message);
      }),
      addMessageListener: vi.fn((listener: (event: MessageEvent<{ type: string }>) => void) => {
        workerListeners.push(listener);
        return () => undefined;
      }),
      terminate: vi.fn(),
    };

    const cameraStart = vi.fn();
    const cameraStop = vi.fn();
    const mockFrame: PoseCameraFrame = {
      kind: 'imageData' as const,
      imageData: { data: new Uint8ClampedArray(4) } as unknown as ImageData,
    };
    const cameraCapture = vi
      .fn<() => Promise<PoseCameraFrame | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockFrame)
      .mockResolvedValue(null);

    const camera: PoseCamera = {
      start: cameraStart,
      stop: cameraStop,
      captureFrame: cameraCapture,
    };

    const dispose = initializePoseAdapter(bus, {
      createWorker: () => mockWorker,
      createCameraService: () => camera,
      requestAnimationFrame: (callback) => setTimeout(() => callback(0), 0) as unknown as number,
      cancelAnimationFrame: (handle) => clearTimeout(handle as unknown as number),
      now: () => 42,
      defaultDebug: true,
    });

    const videoElement = document.createElement('video');

    bus.emit('pose:command', {
      type: 'PIPELINE_START',
      video: videoElement,
      debug: true,
      angle: 'front',
    } satisfies PoseAdapterCommand);

    await vi.runOnlyPendingTimersAsync();

    expect(cameraStart).toHaveBeenCalledWith(videoElement);
    expect(mockWorker.postMessage).toHaveBeenCalled();
    expect(workerMessages[0]).toMatchObject({ type: 'INIT', debug: true, view: 'front' });
    expect(workerMessages[1]).toMatchObject({ type: 'CONFIG', CAMERA_VIEW: 'front' });

    // Trigger worker heartbeat to ensure events flow back through the bus.
    workerListeners[0]?.({ data: { type: 'HEARTBEAT', ts: 100 } } as unknown as MessageEvent<{ type: string }>);
    expect(events).toContain('HEARTBEAT');

    bus.emit('pose:command', { type: 'PIPELINE_STOP' });
    expect(cameraStop).toHaveBeenCalled();

    dispose();
  });
});
