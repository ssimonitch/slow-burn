import type { EngineCommand, EngineEvent } from '@/features/workout-engine/core';
import type { CameraAngle, PoseWorkerEvent, PoseWorkerConfigCommand, TargetFps } from '@/workers';

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
  | { type: 'FAKE_STREAM_STOP' }
  | { type: 'PIPELINE_START'; video: HTMLVideoElement; debug?: boolean; targetFps?: TargetFps; angle: CameraAngle }
  | { type: 'PIPELINE_STOP' }
  | { type: 'PIPELINE_SET_TARGET_FPS'; fps: TargetFps }
  | { type: 'PIPELINE_SET_DEBUG'; debug: boolean }
  | { type: 'PIPELINE_SET_VIEW'; angle: CameraAngle }
  | { type: 'PIPELINE_CONFIG'; config: PoseWorkerConfigCommand };

export type AppEventKey = keyof AppEventMap;
export type AppEventPayload<K extends AppEventKey> = AppEventMap[K];

export type AppEventListener<K extends AppEventKey> = (payload: AppEventPayload<K>) => void;
