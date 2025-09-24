/**
 * Message types exchanged between the main thread and pose worker.
 * Mirrors 12-pose-worker-spec.md (MVP v1).
 */
export type PoseWorkerCommand =
  | PoseWorkerInitCommand
  | PoseWorkerFrameCommand
  | PoseWorkerFrameImageDataCommand
  | PoseWorkerConfigCommand
  | PoseWorkerStopCommand;

export type PoseWorkerCommandType = PoseWorkerCommand["type"];

export interface PoseWorkerInitCommand {
  type: "INIT";
  model: PoseModelId;
  modelBaseUrl?: string;
  modelVersion?: string;
  targetFps?: TargetFps;
  debug?: boolean;
}

export interface PoseWorkerFrameCommand {
  type: "FRAME";
  bitmap: ImageBitmap;
  ts: number;
}

export interface PoseWorkerFrameImageDataCommand {
  type: "FRAME_IMAGE_DATA";
  imageData: ImageData;
  ts: number;
}

export interface PoseWorkerConfigCommand {
  type: "CONFIG";
  TH_CONF?: number;
  DEBOUNCE_MS?: number;
  THETA_DOWN_DEG?: number;
  THETA_UP_DEG?: number;
  MIN_DOWN_HOLD_MS?: number;
  POSE_LOST_TIMEOUT_MS?: number;
  EMA_ALPHA?: number;
  SINGLE_SIDE_PENALTY?: number;
}

export interface PoseWorkerStopCommand {
  type: "STOP";
}

export interface PoseWorkerConfig {
  keypointConfidenceThreshold: number;
  debounceMs: number;
  minDownHoldMs: number;
  thetaDownDegrees: number;
  thetaUpDegrees: number;
  poseLostTimeoutMs: number;
  emaAlpha: number;
  singleSidePenalty: number;
}

export const DEFAULT_POSE_WORKER_CONFIG: PoseWorkerConfig = {
  keypointConfidenceThreshold: 0.6,
  debounceMs: 350,
  minDownHoldMs: 150,
  thetaDownDegrees: 100,
  thetaUpDegrees: 160,
  poseLostTimeoutMs: 500,
  emaAlpha: 0.5,
  singleSidePenalty: 0.8,
};

export const TARGET_FPS_OPTIONS = [24, 30] as const;

export type TargetFps = (typeof TARGET_FPS_OPTIONS)[number];

export const DEFAULT_TARGET_FPS: TargetFps = 24;

export type PoseModelId = "movenet_singlepose_lightning";

export type PoseWorkerEvent =
  | PoseWorkerRepCompleteEvent
  | PoseWorkerPoseLostEvent
  | PoseWorkerPoseRegainedEvent
  | PoseWorkerHeartbeatEvent
  | PoseWorkerIdleEvent
  | PoseWorkerErrorEvent
  | PoseWorkerDebugMetricsEvent;

export type PoseWorkerEventType = PoseWorkerEvent["type"];

export interface PoseWorkerRepCompleteEvent {
  type: "REP_COMPLETE";
  ts: number;
  exercise: "squat";
  confidence: number;
  fps?: number;
}

export interface PoseWorkerPoseLostEvent {
  type: "POSE_LOST";
  ts: number;
}

export interface PoseWorkerPoseRegainedEvent {
  type: "POSE_REGAINED";
  ts: number;
}

export interface PoseWorkerHeartbeatEvent {
  type: "HEARTBEAT";
  ts: number;
  fps?: number;
  backend?: PoseBackend;
}

export interface PoseWorkerIdleEvent {
  type: "WORKER_IDLE";
  ts: number;
}

export interface PoseWorkerErrorEvent {
  type: "ERROR";
  ts: number;
  code: PoseWorkerErrorCode;
  message?: string;
}

export interface PoseWorkerDebugMetricsEvent {
  type: "DEBUG_METRICS";
  ts: number;
  theta?: number;
  state?: PoseWorkerPhaseState;
  valid?: boolean;
}

export type PoseWorkerPhaseState = "NO_POSE" | "UP" | "DOWN";

export type PoseWorkerErrorCode =
  | "MODEL_LOAD"
  | "FRAME_DECODE"
  | "FRAME_NOT_SUPPORTED"
  | "BACKEND_INIT"
  | "INTERNAL";

export type PoseBackend = "webgpu" | "webgl" | "wasm";

export function isPoseWorkerCommand(
  value: unknown,
): value is PoseWorkerCommand {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

export function isPoseWorkerEvent(value: unknown): value is PoseWorkerEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

export interface PoseWorkerConfigSettings {
  readonly keypointConfidenceThreshold: PoseWorkerConfigField<number>;
  readonly debounceMs: PoseWorkerConfigField<number>;
  readonly minDownHoldMs: PoseWorkerConfigField<number>;
  readonly thetaDownDegrees: PoseWorkerConfigField<number>;
  readonly thetaUpDegrees: PoseWorkerConfigField<number>;
  readonly poseLostTimeoutMs: PoseWorkerConfigField<number>;
  readonly emaAlpha: PoseWorkerConfigField<number>;
  readonly singleSidePenalty: PoseWorkerConfigField<number>;
}

export interface PoseWorkerConfigField<TValue> {
  readonly defaultValue: TValue;
  readonly min?: TValue;
  readonly max?: TValue;
  readonly step?: TValue;
}

export const POSE_WORKER_CONFIG_SETTINGS: PoseWorkerConfigSettings = {
  keypointConfidenceThreshold: {
    defaultValue: DEFAULT_POSE_WORKER_CONFIG.keypointConfidenceThreshold,
    min: 0,
    max: 1,
    step: 0.05,
  },
  debounceMs: {
    defaultValue: DEFAULT_POSE_WORKER_CONFIG.debounceMs,
    min: 200,
    max: 1000,
    step: 10,
  },
  minDownHoldMs: {
    defaultValue: DEFAULT_POSE_WORKER_CONFIG.minDownHoldMs,
    min: 0,
    max: 500,
    step: 10,
  },
  thetaDownDegrees: {
    defaultValue: DEFAULT_POSE_WORKER_CONFIG.thetaDownDegrees,
    min: 60,
    max: 140,
    step: 1,
  },
  thetaUpDegrees: {
    defaultValue: DEFAULT_POSE_WORKER_CONFIG.thetaUpDegrees,
    min: 120,
    max: 179,
    step: 1,
  },
  poseLostTimeoutMs: {
    defaultValue: DEFAULT_POSE_WORKER_CONFIG.poseLostTimeoutMs,
    min: 100,
    max: 2000,
    step: 10,
  },
  emaAlpha: {
    defaultValue: DEFAULT_POSE_WORKER_CONFIG.emaAlpha,
    min: 0.1,
    max: 0.9,
    step: 0.05,
  },
  singleSidePenalty: {
    defaultValue: DEFAULT_POSE_WORKER_CONFIG.singleSidePenalty,
    min: 0,
    max: 1,
    step: 0.05,
  },
};
