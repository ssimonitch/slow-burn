# Worker Integration Notes — Audio & Pose

**Updated:** 2025-??-??  
**Scope:** Guidance for wiring the off-main-thread workers into the Slow Burn app shell once UI scaffolding begins. Covers audio preloading and pose inference workers.

## 1. Audio Preload Worker

### 1.1 Purpose
- Warm critical session audio prompts (count-in, rep cues, motivational samples) without blocking the main thread.
- Ensure assets are cached/decoded before practice begins so playback latency stays low.

### 1.2 Lifecycle
1. **Creation** — During session boot (e.g. when the workout engine transitions to `session::prepare`), call `createAudioPreloadWorker()` from `@/workers` and retain the handle.
2. **Preload request** — Send `{ type: 'AUDIO_PRELOAD', id, urls }` with a unique `id` per batch. Group prompts by upcoming phase to reuse cached buffers.
3. **Progress events** — Listen for `AUDIO_PRELOAD_PROGRESS` to update any debug HUD/logging.
4. **Completion** — On `AUDIO_PRELOAD_COMPLETE`, notify the workout engine that audio is ready. The `failed` array identifies URLs that need fallback handling.
5. **Abort** — When abandoning or replacing a session, send `{ type: 'AUDIO_PRELOAD_ABORT', id }` (or omit `id` to cancel all) and then `handle.terminate()`.

### 1.3 Wiring Checklist
- Worker lives behind the existing `@/services/audio` abstraction. That service should:
  - Translate workout events into preload batches (e.g. next two segments).
  - Cache resolved buffers/URLs in IndexedDB or keep them in memory.
  - Provide fallback playback (e.g. stream) if preload fails.
- Expose dev-only telemetry (counts, last failure) via the debug overlay.
- Ensure URLs passed to the worker already include Vite base paths or CDN prefixes.

## 2. Pose Worker

### 2.1 Purpose
- Run MoveNet inference and squat rep detection in a Web Worker, emitting events consumed by the workout engine.

### 2.2 Lifecycle
1. **Creation** — When the practice screen mounts, call `createPoseWorker()` and subscribe to `HEARTBEAT`, `REP_COMPLETE`, `POSE_LOST`, `POSE_REGAINED`, and dev-only events.
2. **Initialization** — Immediately send `{ type: 'INIT', ... }` with `model`, optional `modelBaseUrl`, target FPS, and `debug` flag (tie to `import.meta.env.DEV`).
3. **Frame feed** — Pipe camera frames into worker via `FRAME` (`ImageBitmap`) or `FRAME_IMAGE_DATA` fallback. Stamp frames with the session-relative timestamp so worker events align with the event bus clock.
4. **Configuration updates** — Project debug panel should translate slider adjustments into `CONFIG` commands to tweak thresholds on the fly.
5. **Shutdown** — When exiting practice, send `{ type: 'STOP' }`, wait for confirmation heartbeat, then terminate the worker.

### 2.3 Wiring Checklist
- Camera service owns the capture loop and throttles frame delivery based on `HEARTBEAT` FPS telemetry.
- Event bus adapter converts worker events into domain events defined in `docs/01_system/11-event-loop-spec.md`.
- UI debug overlay displays `DEBUG_METRICS` (θ̂, state, valid) when `debug` is enabled.
- Long-term: abstract detection state so additional exercises can extend `workerState` without rewriting the transport layer.

## 3. Open Tasks
- Decide final ownership of worker handles (likely a dedicated provider under `@/features/workout-engine`).
- Add Vitest coverage for worker message guards and lifecycle helpers once UI infrastructure lands.
- Verify Workbox precaches model/audio assets to match worker default paths.
