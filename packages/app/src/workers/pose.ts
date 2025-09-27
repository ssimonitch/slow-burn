import '@tensorflow/tfjs-converter';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs-core';
import * as poseDetection from '@tensorflow-models/pose-detection';

import {
  DEFAULT_POSE_WORKER_CONFIG,
  DEFAULT_TARGET_FPS,
  type CameraAngle,
  type PoseBackend,
  type PoseWorkerCommand,
  type PoseWorkerConfig,
  type PoseWorkerConfigCommand,
  type PoseWorkerDebugMetricsEvent,
  type PoseWorkerEvent,
  type PoseWorkerFrameCommand,
  type PoseWorkerFrameImageDataCommand,
  type PoseWorkerInitCommand,
  type PoseWorkerPhaseState,
  type PoseWorkerErrorCode,
  type TargetFps,
} from './pose.types';
import { computeHipDeltaMetrics, computeKneeMetrics, type PoseKeypoint } from './poseMath';

const HEARTBEAT_MIN_INTERVAL_MS = 1000;
const WORKER_IDLE_TIMEOUT_MS = 2000;
const DEBUG_METRICS_MIN_INTERVAL_MS = 500;

const VIEW_TUNING: Record<
  CameraAngle,
  { confidenceDelta: number; thetaDownDelta: number; thetaUpDelta: number; singleSidePenaltyDelta: number }
> = {
  front: { confidenceDelta: 0, thetaDownDelta: 0, thetaUpDelta: 0, singleSidePenaltyDelta: 0 },
  side: { confidenceDelta: -0.05, thetaDownDelta: -5, thetaUpDelta: 0, singleSidePenaltyDelta: 0 },
  back: { confidenceDelta: -0.2, thetaDownDelta: -15, thetaUpDelta: -10, singleSidePenaltyDelta: 0.05 },
};

const BACK_HIP_DOWN_RATIO = 0.45;
const BACK_HIP_UP_RATIO = 0.75;

interface WorkerRuntimeState {
  config: PoseWorkerConfig;
  debug: boolean;
  targetFps: TargetFps;
  backend?: PoseBackend;
  cameraView: CameraAngle;
  processing: boolean;
  lastFrameTs?: number;
  prevFrameTs?: number;
  lastFrameDurationMs?: number;
  heartbeatLastSentAt?: number;
  modelWarm?: boolean;
  debugMetricsLastSentAt?: number;
  squat: SquatDetectionState;
}

interface SquatDetectionState {
  phase: PoseWorkerPhaseState;
  downHoldStartedAt?: number;
  lastValidPoseTs?: number;
  lastRepTs?: number;
  poseLostNotified: boolean;
  emaTheta?: number;
  hipBaselineDelta?: number;
  emaHipDelta?: number;
}

interface PoseAnalysis {
  readonly poseValid: boolean;
  readonly theta?: number;
  readonly smoothedTheta?: number;
  readonly confidence: number;
}

let workerState: WorkerRuntimeState = createInitialState();
let idleTimeoutId: number | undefined;
let detector: poseDetection.PoseDetector | null = null;
let detectorPromise: Promise<poseDetection.PoseDetector> | null = null;

self.addEventListener('message', async (event) => {
  const message = event.data as PoseWorkerCommand;

  switch (message.type) {
    case 'INIT':
      await handleInit(message);
      break;
    case 'FRAME':
      await handleFrame(message);
      break;
    case 'FRAME_IMAGE_DATA':
      await handleFrameImageData(message);
      break;
    case 'CONFIG':
      handleConfig(message);
      break;
    case 'STOP':
      handleStop();
      break;
    default:
      break;
  }
});

async function handleInit(command: PoseWorkerInitCommand) {
  workerState.debug = Boolean(command.debug);
  workerState.targetFps = command.targetFps ?? DEFAULT_TARGET_FPS;
  if (command.view) {
    workerState.cameraView = command.view;
    workerState.squat = createInitialSquatDetectionState();
  }
  resetIdleTimer();
}

async function handleFrame(command: PoseWorkerFrameCommand) {
  if (!shouldProcessFrame(command.ts)) {
    command.bitmap.close();
    return;
  }

  try {
    markFrameProcessing(command.ts);
    const analysis = await processImage(command.bitmap, command.ts);
    emitDebugMetrics(command.ts, analysis);
  } catch (unknownError) {
    postError('INTERNAL', unknownError, command.ts);
  } finally {
    command.bitmap.close();
    workerState.processing = false;
    postHeartbeat(command.ts);
    resetIdleTimer(command.ts);
  }
}

async function handleFrameImageData(command: PoseWorkerFrameImageDataCommand) {
  if (!shouldProcessFrame(command.ts)) {
    return;
  }

  try {
    markFrameProcessing(command.ts);
    const analysis = await processImage(command.imageData, command.ts);
    emitDebugMetrics(command.ts, analysis);
  } catch (unknownError) {
    postError('INTERNAL', unknownError, command.ts);
  } finally {
    workerState.processing = false;
    postHeartbeat(command.ts);
    resetIdleTimer(command.ts);
  }
}

function handleConfig(command: PoseWorkerConfigCommand) {
  const patch = resolveConfigPatch(command);
  if (patch) {
    workerState.config = {
      ...workerState.config,
      ...patch,
    };
  }

  if (typeof command.CAMERA_VIEW === 'string') {
    workerState.cameraView = command.CAMERA_VIEW;
    workerState.squat = createInitialSquatDetectionState();
  }
}

function handleStop() {
  const preservedView = workerState.cameraView;
  workerState = createInitialState();
  workerState.cameraView = preservedView;
  clearIdleTimer();
  void disposeDetector();
}

function shouldProcessFrame(frameTs: number): boolean {
  if (workerState.processing) {
    return false;
  }

  if (workerState.lastFrameTs != null) {
    const elapsed = frameTs - workerState.lastFrameTs;
    const targetInterval = 1000 / workerState.targetFps;
    if (elapsed < targetInterval) {
      return false;
    }
  }

  return true;
}

function markFrameProcessing(frameTs: number) {
  const prevFrameTs = workerState.lastFrameTs;
  const duration = prevFrameTs != null ? frameTs - prevFrameTs : undefined;

  workerState.processing = true;
  workerState.prevFrameTs = prevFrameTs;
  workerState.lastFrameTs = frameTs;
  workerState.lastFrameDurationMs = duration;
}

async function processImage(image: ImageBitmap | ImageData, frameTs: number): Promise<PoseAnalysis> {
  const detectorInstance = await ensureDetector();
  workerState.modelWarm = true;

  tf.engine().startScope();
  let poses: poseDetection.Pose[] = [];
  try {
    poses = await detectorInstance.estimatePoses(image, { flipHorizontal: false });
  } finally {
    tf.engine().endScope();
  }

  const pose = poses[0] ?? null;
  return updateSquatState(pose, frameTs);
}

async function ensureDetector(): Promise<poseDetection.PoseDetector> {
  if (detector) {
    return detector;
  }
  if (detectorPromise) {
    return detectorPromise;
  }

  detectorPromise = (async () => {
    workerState.backend = await resolveBackend();
    const detectorInstance = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });
    detector = detectorInstance;
    return detectorInstance;
  })().catch((error) => {
    detectorPromise = null;
    throw error;
  });

  return detectorPromise;
}

async function resolveBackend(): Promise<PoseBackend> {
  const candidates: Array<{ name: string; backend: PoseBackend }> = [{ name: 'webgl', backend: 'webgl' }];

  for (const candidate of candidates) {
    try {
      await tf.setBackend(candidate.name);
      await tf.ready();
      return candidate.backend;
    } catch {
      continue;
    }
  }

  await tf.setBackend('cpu');
  await tf.ready();
  return 'cpu';
}

async function disposeDetector() {
  detectorPromise = null;

  if (detector) {
    try {
      await detector.dispose();
    } catch {
      // ignore disposal errors
    }
    detector = null;
  }
}

function updateSquatState(pose: poseDetection.Pose | null, frameTs: number): PoseAnalysis {
  if (!pose || !pose.keypoints?.length) {
    return applyPoseLost(frameTs);
  }

  if (workerState.cameraView === 'back') {
    return updateSquatStateBack(pose, frameTs);
  }

  return updateSquatStateFrontSide(pose, frameTs);
}

function updateSquatStateFrontSide(pose: poseDetection.Pose, frameTs: number): PoseAnalysis {
  const squat = workerState.squat;
  const config = workerState.config;
  const tuning = VIEW_TUNING[workerState.cameraView];

  const confidenceThreshold = clamp(config.keypointConfidenceThreshold + tuning.confidenceDelta, 0.2, 0.95);
  const thetaDown = config.thetaDownDegrees + tuning.thetaDownDelta;
  const thetaUp = config.thetaUpDegrees + tuning.thetaUpDelta;
  const singleSidePenalty = clamp(config.singleSidePenalty + tuning.singleSidePenaltyDelta, 0.1, 1);

  const metrics = computeKneeMetrics(toPoseKeypoints(pose.keypoints), {
    confidenceThreshold,
    singleSidePenalty,
  });

  if (!metrics.isValid || metrics.theta == null) {
    return applyPoseLost(frameTs);
  }

  if (squat.poseLostNotified) {
    emit({ type: 'POSE_REGAINED', ts: frameTs });
    squat.poseLostNotified = false;
  }

  squat.lastValidPoseTs = frameTs;
  squat.emaTheta =
    squat.emaTheta == null ? metrics.theta : squat.emaTheta + config.emaAlpha * (metrics.theta - squat.emaTheta);

  const smoothedTheta = squat.emaTheta ?? metrics.theta;

  if (squat.phase === 'NO_POSE' && smoothedTheta >= thetaUp) {
    squat.phase = 'UP';
  }

  if (squat.phase === 'UP') {
    if (smoothedTheta <= thetaDown) {
      if (squat.downHoldStartedAt == null) {
        squat.downHoldStartedAt = frameTs;
      }
      if (frameTs - squat.downHoldStartedAt >= config.minDownHoldMs) {
        squat.phase = 'DOWN';
      }
    } else {
      squat.downHoldStartedAt = undefined;
    }
  } else if (squat.phase === 'DOWN') {
    if (smoothedTheta >= thetaUp) {
      const sinceRep = squat.lastRepTs != null ? frameTs - squat.lastRepTs : Number.POSITIVE_INFINITY;
      if (sinceRep >= config.debounceMs) {
        squat.phase = 'UP';
        squat.downHoldStartedAt = undefined;
        squat.lastRepTs = frameTs;
        emit({
          type: 'REP_COMPLETE',
          ts: frameTs,
          exercise: 'squat',
          confidence: Math.min(1, metrics.confidence),
          fps: computeFrameFps(),
        });
      }
    }
  }

  // Reset rear-view specific caches to avoid leaking state across modes.
  squat.emaHipDelta = undefined;
  squat.hipBaselineDelta = undefined;

  return {
    poseValid: true,
    theta: metrics.theta,
    smoothedTheta,
    confidence: metrics.confidence,
  };
}

function updateSquatStateBack(pose: poseDetection.Pose, frameTs: number): PoseAnalysis {
  const squat = workerState.squat;
  const config = workerState.config;
  const tuning = VIEW_TUNING.back;

  const confidenceThreshold = clamp(config.keypointConfidenceThreshold + tuning.confidenceDelta, 0.2, 0.9);

  const metrics = computeHipDeltaMetrics(toPoseKeypoints(pose.keypoints), confidenceThreshold);

  if (!metrics.isValid || metrics.delta == null) {
    return applyPoseLost(frameTs);
  }

  if (squat.poseLostNotified) {
    emit({ type: 'POSE_REGAINED', ts: frameTs });
    squat.poseLostNotified = false;
  }

  squat.lastValidPoseTs = frameTs;

  if (squat.hipBaselineDelta == null || metrics.delta > squat.hipBaselineDelta) {
    squat.hipBaselineDelta = metrics.delta;
  }

  if (squat.hipBaselineDelta == null || squat.hipBaselineDelta === 0) {
    squat.hipBaselineDelta = metrics.delta;
  }

  squat.emaHipDelta =
    squat.emaHipDelta == null
      ? metrics.delta
      : squat.emaHipDelta + config.emaAlpha * (metrics.delta - squat.emaHipDelta);

  const smoothedDelta = squat.emaHipDelta ?? metrics.delta;
  const baseline = Math.max(squat.hipBaselineDelta ?? metrics.delta, metrics.delta);
  const downThreshold = baseline * BACK_HIP_DOWN_RATIO;
  const upThreshold = baseline * BACK_HIP_UP_RATIO;

  if (squat.phase === 'NO_POSE' && smoothedDelta >= upThreshold) {
    squat.phase = 'UP';
  }

  if (squat.phase === 'UP') {
    if (smoothedDelta <= downThreshold) {
      if (squat.downHoldStartedAt == null) {
        squat.downHoldStartedAt = frameTs;
      }
      if (frameTs - squat.downHoldStartedAt >= config.minDownHoldMs) {
        squat.phase = 'DOWN';
      }
    } else {
      squat.downHoldStartedAt = undefined;
      // Update baseline slightly when the athlete stands taller between reps.
      if (smoothedDelta > baseline) {
        squat.hipBaselineDelta = smoothedDelta;
      }
    }
  } else if (squat.phase === 'DOWN') {
    if (smoothedDelta >= upThreshold) {
      const sinceRep = squat.lastRepTs != null ? frameTs - squat.lastRepTs : Number.POSITIVE_INFINITY;
      if (sinceRep >= config.debounceMs) {
        squat.phase = 'UP';
        squat.downHoldStartedAt = undefined;
        squat.lastRepTs = frameTs;
        emit({
          type: 'REP_COMPLETE',
          ts: frameTs,
          exercise: 'squat',
          confidence: Math.min(1, metrics.confidence),
          fps: computeFrameFps(),
        });
      }
    }
  }

  // Theta-based state is not relevant for back view.
  squat.emaTheta = undefined;

  return {
    poseValid: true,
    theta: metrics.delta,
    smoothedTheta: smoothedDelta,
    confidence: metrics.confidence,
  };
}

function applyPoseLost(frameTs: number): PoseAnalysis {
  const squat = workerState.squat;
  const { poseLostTimeoutMs } = workerState.config;
  const previousHipDelta = squat.emaHipDelta;
  const previousTheta = squat.emaTheta;

  if (
    squat.lastValidPoseTs != null &&
    frameTs - squat.lastValidPoseTs >= poseLostTimeoutMs &&
    !squat.poseLostNotified
  ) {
    squat.poseLostNotified = true;
    emit({ type: 'POSE_LOST', ts: frameTs });
  }

  if (squat.poseLostNotified) {
    squat.phase = 'NO_POSE';
    squat.hipBaselineDelta = undefined;
    squat.emaHipDelta = undefined;
    squat.emaTheta = undefined;
  }

  squat.downHoldStartedAt = undefined;

  const smoothed = workerState.cameraView === 'back' ? previousHipDelta : previousTheta;

  return {
    poseValid: false,
    theta: undefined,
    smoothedTheta: smoothed,
    confidence: 0,
  };
}

function emit(event: PoseWorkerEvent) {
  self.postMessage(event);
}

function emitDebugMetrics(frameTs: number, analysis: PoseAnalysis) {
  emitDebug({
    type: 'DEBUG_METRICS',
    ts: frameTs,
    theta: analysis.smoothedTheta ?? analysis.theta,
    state: workerState.squat.phase,
    valid: analysis.poseValid,
    confidence: analysis.confidence,
  });
}

function emitDebug(event: PoseWorkerDebugMetricsEvent) {
  if (!workerState.debug) {
    return;
  }

  const now = performance.now();

  if (
    workerState.debugMetricsLastSentAt != null &&
    now - workerState.debugMetricsLastSentAt < DEBUG_METRICS_MIN_INTERVAL_MS
  ) {
    return;
  }

  workerState.debugMetricsLastSentAt = now;
  self.postMessage(event);
}

function emitIdle(frameTs: number) {
  if (!workerState.debug) {
    return;
  }

  emit({
    type: 'WORKER_IDLE',
    ts: frameTs,
  });
}

function postHeartbeat(frameTs: number) {
  const now = performance.now();

  if (workerState.heartbeatLastSentAt != null && now - workerState.heartbeatLastSentAt < HEARTBEAT_MIN_INTERVAL_MS) {
    return;
  }

  emit({
    type: 'HEARTBEAT',
    ts: frameTs,
    backend: workerState.backend,
    fps: computeFrameFps(),
  });

  workerState.heartbeatLastSentAt = now;
}

function computeFrameFps(): number | undefined {
  if (!workerState.lastFrameDurationMs || workerState.lastFrameDurationMs === 0) {
    return undefined;
  }

  return Math.round((1000 / workerState.lastFrameDurationMs) * 10) / 10;
}

function postError(code: PoseWorkerErrorCode, error: unknown, frameTs: number) {
  emit({
    type: 'ERROR',
    ts: frameTs,
    code,
    message: error instanceof Error ? error.message : undefined,
  });
}

function resolveConfigPatch(command: PoseWorkerConfigCommand): Partial<PoseWorkerConfig> | null {
  const patch: Partial<PoseWorkerConfig> = {};

  if (typeof command.TH_CONF === 'number') {
    patch.keypointConfidenceThreshold = command.TH_CONF;
  }
  if (typeof command.DEBOUNCE_MS === 'number') {
    patch.debounceMs = command.DEBOUNCE_MS;
  }
  if (typeof command.MIN_DOWN_HOLD_MS === 'number') {
    patch.minDownHoldMs = command.MIN_DOWN_HOLD_MS;
  }
  if (typeof command.THETA_DOWN_DEG === 'number') {
    patch.thetaDownDegrees = command.THETA_DOWN_DEG;
  }
  if (typeof command.THETA_UP_DEG === 'number') {
    patch.thetaUpDegrees = command.THETA_UP_DEG;
  }
  if (typeof command.POSE_LOST_TIMEOUT_MS === 'number') {
    patch.poseLostTimeoutMs = command.POSE_LOST_TIMEOUT_MS;
  }
  if (typeof command.EMA_ALPHA === 'number') {
    patch.emaAlpha = command.EMA_ALPHA;
  }
  if (typeof command.SINGLE_SIDE_PENALTY === 'number') {
    patch.singleSidePenalty = command.SINGLE_SIDE_PENALTY;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function resetIdleTimer(lastFrameTs?: number) {
  clearIdleTimer();

  if (!workerState.debug) {
    return;
  }

  const ts = lastFrameTs ?? workerState.lastFrameTs ?? performance.now();

  idleTimeoutId = self.setTimeout(() => {
    emitIdle(ts);
    idleTimeoutId = undefined;
  }, WORKER_IDLE_TIMEOUT_MS);
}

function clearIdleTimer() {
  if (idleTimeoutId != null) {
    self.clearTimeout(idleTimeoutId);
    idleTimeoutId = undefined;
  }
}

function createInitialState(): WorkerRuntimeState {
  return {
    config: DEFAULT_POSE_WORKER_CONFIG,
    debug: false,
    targetFps: DEFAULT_TARGET_FPS,
    backend: undefined,
    cameraView: 'front',
    processing: false,
    lastFrameTs: undefined,
    prevFrameTs: undefined,
    lastFrameDurationMs: undefined,
    heartbeatLastSentAt: undefined,
    modelWarm: false,
    debugMetricsLastSentAt: undefined,
    squat: createInitialSquatDetectionState(),
  };
}

function createInitialSquatDetectionState(): SquatDetectionState {
  return {
    phase: 'NO_POSE',
    downHoldStartedAt: undefined,
    lastValidPoseTs: undefined,
    lastRepTs: undefined,
    poseLostNotified: false,
    emaTheta: undefined,
    hipBaselineDelta: undefined,
    emaHipDelta: undefined,
  };
}

function toPoseKeypoints(keypoints: readonly poseDetection.Keypoint[]): PoseKeypoint[] {
  return keypoints.map((keypoint) => {
    const identifier = keypoint.name ?? (keypoint as { part?: string }).part;
    return {
      x: keypoint.x,
      y: keypoint.y,
      score: keypoint.score,
      name: identifier,
      part: identifier,
    };
  });
}

// TODO: refine squat heuristics as we collect real footage.

export {};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
