import type { EngineCommand, EngineEvent } from '@/features/workout-engine/core';
import type { PoseWorkerEvent } from '@/workers';

export type AppEventMap = {
  'engine:command': EngineCommand;
  'engine:event': EngineEvent;
  'pose:event': PoseWorkerEvent;
  'pose:command': PoseAdapterCommand;
  'debug:log': { message: string; ts: number; source?: string };
};

export type PoseAdapterCommand =
  | { type: 'FAKE_REP' }
  | { type: 'FAKE_STREAM_START'; intervalMs?: number }
  | { type: 'FAKE_STREAM_STOP' };

export type AppEventKey = keyof AppEventMap;
export type AppEventPayload<K extends AppEventKey> = AppEventMap[K];

export type AppEventListener<K extends AppEventKey> = (payload: AppEventPayload<K>) => void;
