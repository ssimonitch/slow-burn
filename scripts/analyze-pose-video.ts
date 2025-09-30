#!/usr/bin/env node

/**
 * Pose Video Analysis Harness
 *
 * Offline evaluation tool that processes video files through the pose detection worker
 * and exports metrics for accuracy validation and parameter tuning.
 *
 * Usage:
 *   pnpm analyze-pose-video \
 *     --video packages/infra/pose-tuning/raw/squat_front_01.mp4 \
 *     --angle front \
 *     --exercise squat \
 *     --config-override '{"thetaDownDegrees":95}' \
 *     --out packages/infra/pose-tuning/processed/squat_front_01_run1.json
 *
 * Architecture:
 *   1. Load video via ffmpeg/canvas
 *   2. Extract frames at native FPS
 *   3. Generate synthetic timestamps matching video timeline
 *   4. Send FRAME_IMAGE_DATA commands to worker
 *   5. Collect all events (REP_COMPLETE, POSE_LOST, DEBUG_*)
 *   6. Export JSON with metadata + events + per-frame metrics
 *
 * Requirements:
 *   - Node.js with canvas support (for ImageBitmap/ImageData)
 *   - ffmpeg (for video frame extraction)
 *   - Worker bridge (to run Web Worker in Node context)
 *
 * Status: STUB - Implementation required
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename, extname } from 'path';

// TODO: Add dependencies to package.json:
// - @ffmpeg-installer/ffmpeg (or fluent-ffmpeg)
// - canvas (for ImageData support in Node.js)
// - worker_threads (Node.js built-in)

interface CliArgs {
  video: string;
  angle: 'front' | 'side' | 'back';
  exercise: string;
  configOverride?: string;
  out: string;
  debug?: boolean;
  batch?: boolean;
}

interface VideoMetadata {
  id: string;
  fps: number;
  durationMs: number;
  width: number;
  height: number;
  frameCount: number;
}

interface PoseWorkerEvent {
  type: string;
  ts: number;
  [key: string]: unknown;
}

interface AnalysisOutput {
  video_meta: VideoMetadata;
  config: Record<string, unknown>;
  events: PoseWorkerEvent[];
  frame_metrics: Array<{
    ts: number;
    theta?: number;
    confidence: number;
    valid: boolean;
    state?: string;
  }>;
  summary: {
    total_reps_detected: number;
    pose_lost_count: number;
    avg_confidence: number;
    avg_fps?: number;
  };
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs();

  console.log('🎥 Pose Video Analysis Harness');
  console.log('==============================\n');

  if (args.batch) {
    await processBatch(args);
  } else {
    await processSingleVideo(args);
  }
}

/**
 * Process a single video file
 */
async function processSingleVideo(args: CliArgs): Promise<void> {
  console.log(`📹 Processing video: ${args.video}`);
  console.log(`   Angle: ${args.angle}`);
  console.log(`   Exercise: ${args.exercise}\n`);

  // Step 1: Validate inputs
  if (!existsSync(args.video)) {
    console.error(`❌ Error: Video file not found: ${args.video}`);
    process.exit(1);
  }

  // Step 2: Extract video metadata
  console.log('📊 Extracting video metadata...');
  const metadata = await extractVideoMetadata(args.video);
  console.log(`   FPS: ${metadata.fps}`);
  console.log(`   Duration: ${metadata.durationMs}ms`);
  console.log(`   Resolution: ${metadata.width}x${metadata.height}`);
  console.log(`   Frames: ${metadata.frameCount}\n`);

  // Step 3: Initialize pose worker
  console.log('🤖 Initializing pose worker...');
  const config = args.configOverride ? JSON.parse(args.configOverride) : {};
  const worker = await initializePoseWorker(args.angle, args.exercise, config, args.debug ?? false);
  console.log('   Worker initialized\n');

  // Step 4: Process frames
  console.log('🔄 Processing frames...');
  const { events, frameMetrics } = await processVideoFrames(
    args.video,
    metadata,
    worker,
    args.debug ?? false
  );
  console.log(`   Collected ${events.length} events\n`);

  // Step 5: Compute summary
  const summary = computeSummary(events, frameMetrics);
  console.log('📈 Summary:');
  console.log(`   Reps detected: ${summary.total_reps_detected}`);
  console.log(`   Pose lost events: ${summary.pose_lost_count}`);
  console.log(`   Avg confidence: ${summary.avg_confidence.toFixed(3)}`);
  if (summary.avg_fps) {
    console.log(`   Avg FPS: ${summary.avg_fps.toFixed(1)}\n`);
  }

  // Step 6: Export results
  const output: AnalysisOutput = {
    video_meta: metadata,
    config,
    events,
    frame_metrics: frameMetrics,
    summary,
  };

  writeFileSync(args.out, JSON.stringify(output, null, 2));
  console.log(`✅ Results saved to: ${args.out}`);

  // Step 7: Cleanup
  await terminateWorker(worker);
}

/**
 * Process multiple videos (batch mode)
 */
async function processBatch(args: CliArgs): Promise<void> {
  console.log('🎬 Batch processing mode\n');

  // TODO: Implement batch processing
  // - Parse glob pattern from args.video
  // - Iterate over matching files
  // - Process each video
  // - Generate combined report

  throw new Error('Batch mode not yet implemented');
}

/**
 * Extract video metadata using ffprobe
 */
async function extractVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  // TODO: Implement using ffprobe
  // Example command:
  //   ffprobe -v quiet -print_format json -show_format -show_streams video.mp4
  //
  // Parse output to extract:
  // - fps: streams[0].r_frame_rate (e.g., "30/1" → 30)
  // - duration: format.duration * 1000
  // - width/height: streams[0].width, streams[0].height
  // - frameCount: streams[0].nb_frames or duration * fps

  const filename = basename(videoPath, extname(videoPath));

  // Stub values for now
  return {
    id: filename,
    fps: 30,
    durationMs: 45000,
    width: 1920,
    height: 1080,
    frameCount: 1350,
  };
}

/**
 * Initialize pose worker in Node.js context
 */
async function initializePoseWorker(
  angle: string,
  exercise: string,
  configOverride: Record<string, unknown>,
  debug: boolean
): Promise<WorkerHandle> {
  // TODO: Implement worker initialization
  //
  // Challenges:
  // 1. Web Workers don't run directly in Node.js
  // 2. TensorFlow.js needs WebGL or CPU backend
  //
  // Solutions:
  // A) Use worker_threads with custom bridge:
  //    - Transpile worker code for Node.js
  //    - Mock browser APIs (ImageBitmap, OffscreenCanvas)
  //    - Use @tensorflow/tfjs-node for CPU inference
  //
  // B) Use headless browser (Puppeteer/Playwright):
  //    - Launch browser context
  //    - Load worker in browser
  //    - Bridge messages between Node and browser
  //
  // C) Use jsdom + canvas package:
  //    - Polyfill browser APIs
  //    - Run worker code directly
  //
  // Recommended: Option B for MVP (highest fidelity to production)
  //              Option A for performance (faster, no browser overhead)

  return {
    postMessage: (message: unknown) => {
      // Stub: Forward to actual worker
      console.log('  → Worker message:', message);
    },
    onMessage: (handler: (event: MessageEvent) => void) => {
      // Stub: Register event handler
    },
    terminate: async () => {
      // Stub: Cleanup
    },
  };
}

/**
 * Process video frames through worker
 */
async function processVideoFrames(
  videoPath: string,
  metadata: VideoMetadata,
  worker: WorkerHandle,
  debug: boolean
): Promise<{ events: PoseWorkerEvent[]; frameMetrics: FrameMetrics[] }> {
  // TODO: Implement frame extraction and processing
  //
  // Pipeline:
  // 1. Extract frames using ffmpeg:
  //    ffmpeg -i video.mp4 -vf fps={fps} frame_%04d.png
  //    OR: Stream frames directly to Node.js buffer
  //
  // 2. For each frame:
  //    a. Load as ImageData (use canvas package)
  //    b. Generate synthetic timestamp: ts = startTs + (frameIndex * 1000/fps)
  //    c. Send FRAME_IMAGE_DATA to worker
  //    d. Collect emitted events
  //
  // 3. Handle events:
  //    - REP_COMPLETE: Count reps
  //    - POSE_LOST/POSE_REGAINED: Track pose validity
  //    - DEBUG_METRICS: Store per-frame metrics
  //    - DEBUG_ANKLE_CHECK: Log ankle validation
  //
  // 4. Progress reporting:
  //    - Log every N frames (e.g., every 100)
  //    - Show progress bar in terminal

  const events: PoseWorkerEvent[] = [];
  const frameMetrics: FrameMetrics[] = [];

  // Stub: Simulate processing
  console.log(`   Processing ${metadata.frameCount} frames...`);

  // Example: Register event listener
  worker.onMessage((event) => {
    const data = event.data as PoseWorkerEvent;
    events.push(data);

    if (data.type === 'DEBUG_METRICS') {
      frameMetrics.push({
        ts: data.ts,
        theta: (data as any).theta,
        confidence: (data as any).confidence,
        valid: (data as any).valid,
        state: (data as any).state,
      });
    }

    if (debug) {
      console.log(`   [${data.type}] ts=${data.ts}`);
    }
  });

  // Stub: Send INIT command
  worker.postMessage({
    type: 'INIT',
    view: metadata.id.includes('front') ? 'front' : metadata.id.includes('side') ? 'side' : 'back',
    debug: debug,
    targetFps: 9999, // Disable throttling for offline analysis
  });

  // Stub: Simulate frame loop
  // In real implementation, extract frames and send to worker
  for (let i = 0; i < metadata.frameCount; i++) {
    const ts = i * (1000 / metadata.fps);

    // TODO: Extract frame as ImageData
    // TODO: Send FRAME_IMAGE_DATA command
    // worker.postMessage({
    //   type: 'FRAME_IMAGE_DATA',
    //   imageData: frameImageData,
    //   ts: ts,
    // });

    // Progress update
    if (i % 100 === 0) {
      const progress = ((i / metadata.frameCount) * 100).toFixed(1);
      console.log(`   Progress: ${progress}% (frame ${i}/${metadata.frameCount})`);
    }
  }

  // Send STOP command
  worker.postMessage({ type: 'STOP' });

  return { events, frameMetrics };
}

/**
 * Compute summary statistics
 */
function computeSummary(
  events: PoseWorkerEvent[],
  frameMetrics: FrameMetrics[]
): AnalysisOutput['summary'] {
  const repEvents = events.filter((e) => e.type === 'REP_COMPLETE');
  const poseLostEvents = events.filter((e) => e.type === 'POSE_LOST');

  const validMetrics = frameMetrics.filter((m) => m.valid);
  const avgConfidence = validMetrics.length > 0
    ? validMetrics.reduce((sum, m) => sum + m.confidence, 0) / validMetrics.length
    : 0;

  const fpsValues = repEvents
    .map((e) => (e as any).fps)
    .filter((fps): fps is number => typeof fps === 'number');
  const avgFps = fpsValues.length > 0
    ? fpsValues.reduce((sum, fps) => sum + fps, 0) / fpsValues.length
    : undefined;

  return {
    total_reps_detected: repEvents.length,
    pose_lost_count: poseLostEvents.length,
    avg_confidence: avgConfidence,
    avg_fps: avgFps,
  };
}

/**
 * Terminate worker and cleanup resources
 */
async function terminateWorker(worker: WorkerHandle): Promise<void> {
  await worker.terminate();
}

/**
 * Parse CLI arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CliArgs> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--video':
        parsed.video = resolve(args[++i]);
        break;
      case '--angle':
        parsed.angle = args[++i] as CliArgs['angle'];
        break;
      case '--exercise':
        parsed.exercise = args[++i];
        break;
      case '--config-override':
        parsed.configOverride = args[++i];
        break;
      case '--out':
        parsed.out = resolve(args[++i]);
        break;
      case '--debug':
        parsed.debug = true;
        break;
      case '--batch':
        parsed.batch = true;
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  // Validate required args
  if (!parsed.video || !parsed.angle || !parsed.exercise || !parsed.out) {
    console.error('Usage: analyze-pose-video --video <path> --angle <front|side|back> --exercise <name> --out <path>');
    process.exit(1);
  }

  return parsed as CliArgs;
}

// Type definitions
interface WorkerHandle {
  postMessage: (message: unknown) => void;
  onMessage: (handler: (event: MessageEvent) => void) => void;
  terminate: () => Promise<void>;
}

interface FrameMetrics {
  ts: number;
  theta?: number;
  confidence: number;
  valid: boolean;
  state?: string;
}

// Run main
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { processSingleVideo, extractVideoMetadata, computeSummary };
