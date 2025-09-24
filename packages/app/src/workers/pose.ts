import {
  DEFAULT_POSE_WORKER_CONFIG,
  DEFAULT_TARGET_FPS,
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
} from "./pose.types";

const HEARTBEAT_MIN_INTERVAL_MS = 1000;
const WORKER_IDLE_TIMEOUT_MS = 2000;
const DEBUG_METRICS_MIN_INTERVAL_MS = 500;

interface WorkerRuntimeState {
  readonly config: PoseWorkerConfig;
  readonly debug: boolean;
  readonly targetFps: TargetFps;
  readonly backend?: PoseBackend;
  readonly processing: boolean;
  readonly lastFrameTs?: number;
  readonly prevFrameTs?: number;
  readonly lastFrameDurationMs?: number;
  readonly heartbeatLastSentAt?: number;
  readonly modelWarm?: boolean;
  readonly debugMetricsLastSentAt?: number;
  readonly squat: SquatDetectionState;
}

interface SquatDetectionState {
  readonly phase: PoseWorkerPhaseState;
  readonly downHoldStartedAt?: number;
  readonly lastValidPoseTs?: number;
  readonly lastRepTs?: number;
}

let workerState: WorkerRuntimeState = createInitialState();
let idleTimeoutId: number | undefined;

self.addEventListener("message", async (event) => {
  const message = event.data as PoseWorkerCommand;

  switch (message.type) {
    case "INIT":
      await handleInit(message);
      break;
    case "FRAME":
      await handleFrame(message);
      break;
    case "FRAME_IMAGE_DATA":
      await handleFrameImageData(message);
      break;
    case "CONFIG":
      handleConfig(message);
      break;
    case "STOP":
      handleStop();
      break;
    default:
      break;
  }
});

async function handleInit(command: PoseWorkerInitCommand) {
  workerState = {
    ...workerState,
    debug: Boolean(command.debug),
    targetFps: command.targetFps ?? DEFAULT_TARGET_FPS,
  };

  // Model load, backend selection, and warmup will be implemented when
  // integrating the actual inference provider. Keep state ready for future.

  resetIdleTimer();
}

async function handleFrame(command: PoseWorkerFrameCommand) {
  if (!shouldProcessFrame(command.ts)) {
    command.bitmap.close();
    return;
  }

  try {
    markFrameProcessing(command.ts);

    // TODO: implement model inference against ImageBitmap.

    emitDebug({
      type: "DEBUG_METRICS",
      ts: command.ts,
      state: workerState.squat.phase,
      valid: false,
    });
  } catch (unknownError) {
    postError("FRAME_DECODE", unknownError, command.ts);
  } finally {
    command.bitmap.close();
    workerState = { ...workerState, processing: false };
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

    // TODO: convert ImageData to tensor and perform inference.

    emitDebug({
      type: "DEBUG_METRICS",
      ts: command.ts,
      state: workerState.squat.phase,
      valid: false,
    });
  } catch (unknownError) {
    postError("FRAME_DECODE", unknownError, command.ts);
  } finally {
    workerState = { ...workerState, processing: false };
    postHeartbeat(command.ts);
    resetIdleTimer(command.ts);
  }
}

function handleConfig(command: PoseWorkerConfigCommand) {
  const patch = resolveConfigPatch(command);
  if (!patch) {
    return;
  }

  workerState = {
    ...workerState,
    config: {
      ...workerState.config,
      ...patch,
    },
  };
}

function handleStop() {
  workerState = createInitialState();
  clearIdleTimer();
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

  workerState = {
    ...workerState,
    processing: true,
    prevFrameTs,
    lastFrameTs: frameTs,
    lastFrameDurationMs: duration,
  };
}

function emit(event: PoseWorkerEvent) {
  self.postMessage(event);
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

  emit(event);

  workerState = {
    ...workerState,
    debugMetricsLastSentAt: now,
  };
}

function emitIdle(frameTs: number) {
  if (!workerState.debug) {
    return;
  }

  emit({
    type: "WORKER_IDLE",
    ts: frameTs,
  });
}

function postHeartbeat(frameTs: number) {
  const now = performance.now();

  if (
    workerState.heartbeatLastSentAt != null &&
    now - workerState.heartbeatLastSentAt < HEARTBEAT_MIN_INTERVAL_MS
  ) {
    return;
  }

  const fps = workerState.lastFrameDurationMs
    ? Math.round((1000 / workerState.lastFrameDurationMs) * 10) / 10
    : undefined;

  emit({
    type: "HEARTBEAT",
    ts: frameTs,
    backend: workerState.backend,
    fps,
  });

  workerState = {
    ...workerState,
    heartbeatLastSentAt: now,
  };
}

function postError(code: PoseWorkerErrorCode, error: unknown, frameTs: number) {
  emit({
    type: "ERROR",
    ts: frameTs,
    code,
    message: error instanceof Error ? error.message : undefined,
  });
}

function resolveConfigPatch(
  command: PoseWorkerConfigCommand,
): Partial<PoseWorkerConfig> | null {
  const patch: Partial<PoseWorkerConfig> = {};

  if (typeof command.TH_CONF === "number") {
    patch.keypointConfidenceThreshold = command.TH_CONF;
  }
  if (typeof command.DEBOUNCE_MS === "number") {
    patch.debounceMs = command.DEBOUNCE_MS;
  }
  if (typeof command.MIN_DOWN_HOLD_MS === "number") {
    patch.minDownHoldMs = command.MIN_DOWN_HOLD_MS;
  }
  if (typeof command.THETA_DOWN_DEG === "number") {
    patch.thetaDownDegrees = command.THETA_DOWN_DEG;
  }
  if (typeof command.THETA_UP_DEG === "number") {
    patch.thetaUpDegrees = command.THETA_UP_DEG;
  }
  if (typeof command.POSE_LOST_TIMEOUT_MS === "number") {
    patch.poseLostTimeoutMs = command.POSE_LOST_TIMEOUT_MS;
  }
  if (typeof command.EMA_ALPHA === "number") {
    patch.emaAlpha = command.EMA_ALPHA;
  }
  if (typeof command.SINGLE_SIDE_PENALTY === "number") {
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
    processing: false,
    lastFrameTs: undefined,
    prevFrameTs: undefined,
    lastFrameDurationMs: undefined,
    heartbeatLastSentAt: undefined,
    modelWarm: false,
    debugMetricsLastSentAt: undefined,
    squat: {
      phase: "NO_POSE",
      downHoldStartedAt: undefined,
      lastValidPoseTs: undefined,
      lastRepTs: undefined,
    },
  };
}

// TODO: integrate pose estimator, compute joint angles, update phase state machine.
// TODO: emit REP_COMPLETE, POSE_LOST, and POSE_REGAINED events per spec once estimator is wired.

export {};
