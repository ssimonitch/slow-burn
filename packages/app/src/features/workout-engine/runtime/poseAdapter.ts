import { PoseCameraService, type PoseCamera, type PoseCameraFrame } from '@/features/pose';
import type { EventBus } from '@/services/event-bus/eventBus';
import type { PoseAdapterCommand } from '@/services/event-bus';
import {
  createPoseWorker,
  DEFAULT_TARGET_FPS,
  type CameraAngle,
  type PoseModelId,
  type PoseWorkerConfigCommand,
  type PoseWorkerEvent,
  type PoseWorkerHandle,
  type TargetFps,
} from '@/workers';

/**
 * Event-bus driven bridge that hides all camera/worker wiring behind
 * `pose:command` messages. Consumers interact only through the bus so
 * we can swap worker implementations or run fake reps without touching the shell.
 */

// Options allow tests to inject deterministic timers/cameras/workers.
interface PoseAdapterOptions {
  readonly createWorker?: () => PoseWorkerHandle;
  readonly createCameraService?: () => PoseCamera;
  readonly requestAnimationFrame?: typeof window.requestAnimationFrame;
  readonly cancelAnimationFrame?: typeof window.cancelAnimationFrame;
  readonly now?: () => number;
  readonly defaultModel?: PoseModelId;
  readonly defaultTargetFps?: TargetFps;
  readonly defaultDebug?: boolean;
}

// Internal mutable snapshot so we can coordinate camera + worker lifecycle.
interface PosePipelineState {
  video: HTMLVideoElement | null;
  worker: PoseWorkerHandle | null;
  workerUnsubscribe: (() => void) | null;
  running: boolean;
  targetFps: TargetFps;
  debug: boolean;
  frameLoopId: number | null;
  capturing: boolean;
  lastFrameSentAt: number | null;
  cameraAngle: CameraAngle;
}

const DEFAULT_MODEL: PoseModelId = 'movenet_singlepose_lightning';

export function initializePoseAdapter(bus: EventBus, options: PoseAdapterOptions = {}) {
  const createWorker = options.createWorker ?? createPoseWorker;
  const createCamera = options.createCameraService ?? (() => new PoseCameraService());
  // Prefer native RAF but degrade gracefully in SSR/tests.
  const raf =
    options.requestAnimationFrame ??
    (typeof globalThis !== 'undefined' && typeof globalThis.requestAnimationFrame === 'function'
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16) as unknown as number);
  const caf =
    options.cancelAnimationFrame ??
    (typeof globalThis !== 'undefined' && typeof globalThis.cancelAnimationFrame === 'function'
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : (handle: number) => clearTimeout(handle));
  const now = options.now ?? (() => performance.now());
  const defaultModel = options.defaultModel ?? DEFAULT_MODEL;
  const defaultTargetFps = options.defaultTargetFps ?? DEFAULT_TARGET_FPS;
  const defaultDebug = options.defaultDebug ?? import.meta.env.DEV;

  const camera: PoseCamera = createCamera();

  const pipeline: PosePipelineState = {
    video: null,
    worker: null,
    workerUnsubscribe: null,
    running: false,
    targetFps: defaultTargetFps,
    debug: defaultDebug,
    frameLoopId: null,
    capturing: false,
    lastFrameSentAt: null,
    cameraAngle: 'front',
  };

  let disposed = false;

  const log = (message: string) => {
    bus.emit('debug:log', {
      message,
      ts: now(),
      source: 'pose-adapter',
    });
  };

  const pushCameraView = () => {
    if (!pipeline.worker) {
      return;
    }
    pipeline.worker.postMessage({
      type: 'CONFIG',
      CAMERA_VIEW: pipeline.cameraAngle,
    } satisfies PoseWorkerConfigCommand);
    log(`Pose adapter: camera view set to ${pipeline.cameraAngle}`);
  };

  // Worker spins up lazily so we avoid heavy TF init until the user asks for it.
  const ensureWorker = () => {
    if (pipeline.worker) {
      return pipeline.worker;
    }

    const handle = createWorker();
    pipeline.worker = handle;
    pipeline.workerUnsubscribe = handle.addMessageListener((event) => {
      forwardWorkerEvent(event);
    });

    handle.postMessage({
      type: 'INIT',
      model: defaultModel,
      targetFps: pipeline.targetFps,
      debug: pipeline.debug,
      view: pipeline.cameraAngle,
    });

    return handle;
  };

  const forwardWorkerEvent = (event: MessageEvent<PoseWorkerEvent>) => {
    bus.emit('pose:event', event.data);
  };

  // Self-scheduling loop pulls frames at (roughly) target FPS; we skip work if
  // the worker is still busy or the loop already grabbed a frame recently.
  const startFrameLoop = () => {
    if (pipeline.frameLoopId != null) {
      return;
    }

    const targetInterval = 1000 / pipeline.targetFps;

    const tick = async () => {
      if (!pipeline.running) {
        pipeline.frameLoopId = null;
        return;
      }

      pipeline.frameLoopId = raf(tick);

      if (pipeline.capturing) {
        return;
      }

      const currentTs = now();
      if (pipeline.lastFrameSentAt != null && currentTs - pipeline.lastFrameSentAt < targetInterval) {
        return;
      }

      pipeline.capturing = true;

      try {
        const frame = await camera.captureFrame();
        const worker = pipeline.worker;
        if (!frame || !worker || !pipeline.running) {
          return;
        }

        const frameTs = now();
        pipeline.lastFrameSentAt = frameTs;

        dispatchFrameToWorker(worker, frame, frameTs);
      } catch (error) {
        log(`Pose adapter: failed to capture frame (${error instanceof Error ? error.message : 'unknown'})`);
      } finally {
        pipeline.capturing = false;
      }
    };

    pipeline.frameLoopId = raf(tick);
  };

  const stopFrameLoop = () => {
    if (pipeline.frameLoopId != null) {
      caf(pipeline.frameLoopId);
      pipeline.frameLoopId = null;
    }
    pipeline.capturing = false;
    pipeline.lastFrameSentAt = null;
  };

  const disposeWorker = () => {
    pipeline.workerUnsubscribe?.();
    pipeline.workerUnsubscribe = null;
    pipeline.worker?.terminate();
    pipeline.worker = null;
  };

  // Unified teardown path so camera/workers/fake reps all shut down together.
  const stopPipeline = () => {
    const wasRunning = pipeline.running;

    stopFrameLoop();
    pipeline.running = false;
    pipeline.video = null;
    pipeline.lastFrameSentAt = null;

    if (wasRunning) {
      pipeline.worker?.postMessage({ type: 'STOP' });
    }

    camera.stop();
    disposeWorker();

    if (wasRunning) {
      log('Pose adapter: pipeline stopped');
    }
  };

  // Pipeline start obtains the camera, primes the worker, then begins the frame
  // loop. Any failures emit a pose error so the UI can react.
  const startPipeline = async (command: Extract<PoseAdapterCommand, { type: 'PIPELINE_START' }>) => {
    if (pipeline.running) {
      log('Pose adapter: pipeline already running');
      return;
    }

    pipeline.cameraAngle = command.angle;
    pipeline.targetFps = command.targetFps ?? pipeline.targetFps;
    pipeline.debug = command.debug ?? pipeline.debug;

    try {
      pipeline.video = command.video;
      const worker = ensureWorker();
      if (!worker) {
        throw new Error('Failed to create pose worker');
      }

      pushCameraView();
      // Worker INIT already sent in ensureWorker using current target/debug state.
      await camera.start(command.video);

      pipeline.running = true;
      pipeline.lastFrameSentAt = null;
      startFrameLoop();

      log('Pose adapter: pipeline started');
    } catch (error) {
      stopPipeline();
      const message = error instanceof Error ? error.message : 'unknown error';
      bus.emit('pose:event', {
        type: 'ERROR',
        code: 'INTERNAL',
        message,
        ts: now(),
      });
      log(`Pose adapter: unable to start pipeline (${message})`);
    }
  };

  const applyConfig = (config: PoseWorkerConfigCommand) => {
    if (!pipeline.worker) {
      return;
    }

    pipeline.worker.postMessage(config);
  };

  // Dev-only fake stream remains for times when the real camera is unavailable
  // (CI, early designers). We keep it here so UI code need not special-case.
  let fakeInterval: ReturnType<typeof setInterval> | null = null;

  const emitFakeRep = () => {
    bus.emit('pose:event', {
      type: 'REP_COMPLETE',
      exercise: 'squat',
      confidence: 1,
      ts: now(),
    });
  };

  const stopFakeStream = () => {
    if (fakeInterval != null) {
      clearInterval(fakeInterval);
      fakeInterval = null;
      log('Pose adapter: stopped fake stream');
    }
  };

  const startFakeStream = (intervalMs = 1200) => {
    stopFakeStream();
    fakeInterval = setInterval(emitFakeRep, intervalMs);
    log(`Pose adapter: started fake stream (${intervalMs}ms)`);
  };

  const unsubscribe = bus.subscribe('pose:command', (command: PoseAdapterCommand) => {
    switch (command.type) {
      case 'PIPELINE_START':
        stopFakeStream();
        void startPipeline(command);
        break;
      case 'PIPELINE_STOP':
        stopFakeStream();
        stopPipeline();
        break;
      case 'PIPELINE_SET_TARGET_FPS':
        pipeline.targetFps = command.fps;
        // Take effect on the next frame tick; no worker restart necessary.
        log(`Pose adapter: target fps set to ${command.fps}`);
        break;
      case 'PIPELINE_SET_DEBUG':
        pipeline.debug = command.debug;
        // Applies the next time INIT runs; keeping it lazy prevents surprise
        // restarts mid-session.
        log(`Pose adapter: debug ${command.debug ? 'enabled' : 'disabled'} (applies on next start)`);
        break;
      case 'PIPELINE_SET_VIEW':
        pipeline.cameraAngle = command.angle;
        if (pipeline.running) {
          pushCameraView();
        }
        break;
      case 'PIPELINE_CONFIG':
        applyConfig(command.config);
        break;
      case 'FAKE_REP':
        emitFakeRep();
        break;
      case 'FAKE_STREAM_START':
        startFakeStream(command.intervalMs);
        break;
      case 'FAKE_STREAM_STOP':
        stopFakeStream();
        break;
      default:
        break;
    }
  });

  return () => {
    if (disposed) {
      return;
    }
    disposed = true;

    stopFakeStream();
    stopPipeline();
    unsubscribe();
  };
}

function dispatchFrameToWorker(worker: PoseWorkerHandle, frame: PoseCameraFrame, ts: number) {
  if (frame.kind === 'bitmap') {
    // Transfer ImageBitmap to keep GC pressure low; worker closes it after use.
    worker.postMessage(
      {
        type: 'FRAME',
        bitmap: frame.bitmap,
        ts,
      },
      [frame.bitmap],
    );
    return;
  }

  const transferables: Transferable[] = [];
  const { imageData } = frame;
  if (imageData.data?.buffer) {
    // ImageData path cannot transfer the object itself, but the underlying
    // buffer can be moved to avoid deep copies for large frames.
    transferables.push(imageData.data.buffer);
  }

  worker.postMessage(
    {
      type: 'FRAME_IMAGE_DATA',
      imageData,
      ts,
    },
    transferables,
  );
}

export default initializePoseAdapter;
