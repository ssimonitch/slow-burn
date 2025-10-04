import type { EngineCommand, EngineEvent } from '@/features/workout-engine/core';
import type { CameraAngle, PoseWorkerEvent, PoseWorkerConfigCommand, TargetFps } from '@/workers';

export type AppEventMap = {
  'engine:command': EngineCommand;
  'engine:event': EngineEvent;
  'pose:event': PoseWorkerEvent;
  'pose:command': PoseAdapterCommand;
  'voice:command': VoiceAdapterCommand;
  'voice:telemetry': VoiceTelemetry;
  'voice:decode_progress': VoiceDecodeProgress;
  'voice:caption': VoiceCaption;
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

export type VoiceAdapterCommand =
  | { type: 'VOICE_PRIME' }
  | { type: 'VOICE_MUTE'; mute: boolean }
  | { type: 'VOICE_SET_VOLUME'; volume: number }
  | { type: 'VOICE_SET_RATE'; rate: number }
  | { type: 'VOICE_STOP' };

export type VoiceTelemetry = {
  latency: number;
  p95: number;
  bufferCount: number;
};

export type VoiceDecodeProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type VoiceCaption = {
  text: string;
};

export type AppEventKey = keyof AppEventMap;
export type AppEventPayload<K extends AppEventKey> = AppEventMap[K];

export type AppEventListener<K extends AppEventKey> = (payload: AppEventPayload<K>) => void;
