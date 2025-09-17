# Pose Worker — Spec (MVP v1)
**Doc:** 12-pose-worker-spec.md  
**Updated:** 2025-08-17 (JST)  
**Scope:** Web Worker that performs on-device pose estimation and rep detection for **squats** (only in MVP), emitting sparse events to the UI as defined in **11-event-loop-spec.md**.

> The worker never uploads frames or raw keypoints. It receives **UI-stamped timestamps** (relative ms) and **must mirror** them on outbound events.

---

## 1) Goals & non-goals
**Goals**
- Real-time, robust **squat rep detection** on mid-tier phones.
- Keep the **UI thread smooth** by doing vision inference and rep logic off-main.
- Emit **sparse, typed events**: `REP_COMPLETE`, `POSE_LOST`, `POSE_REGAINED`, `HEARTBEAT`.
- Deterministic timestamping: worker reuses `FRAME.ts` received from UI.

**Non-goals (MVP)**
- Counting non-squat exercises.
- Real-time form correction (reserved for post-MVP).
- Storing frames or full keypoint arrays.

---

## 2) Model, runtime & performance
- **Default model:** **MoveNet SinglePose Lightning** via TensorFlow.js.
  - **Input size:** 192×192.
  - **Why:** fast, small, good enough for rep detection; easy to run in a Worker with TF.js.
- **Backends (preferred → fallback):** `webgpu` → `webgl` → `wasm`.
  - Detect availability at init; expose chosen backend via `HEARTBEAT`.
- **Alt provider (post-MVP):** MediaPipe **Pose Landmarker** 2D/3D via Tasks API behind the same `PoseProvider` interface.
- **Throughput target:** 24–30 fps on modern phones; skip frames when busy.
- **Warmup:** **lazy warmup on first FRAME** using actual video dimensions (allocates correct buffers); run 1–2 dry inferences to JIT kernels.
- **Model assets:** Resolve manifests/weights from `modelBaseUrl` (defaults to `/assets/models/movenet/v1`) so the worker stays in lockstep with the service-worker cache and version pinning described in 10-architecture.

---

## 3) Message protocol (UI ⇄ Worker)
All messages are **structured-clone** objects with a discriminated `type`. Video pixels are passed as **transferable `ImageBitmap`** (preferred) or **`ImageData`** fallback.

### 3.1 UI → Worker
```ts
// initialize the worker and load the model
{ type: 'INIT',
  model: 'movenet_singlepose_lightning',
  modelBaseUrl?: string,      // defaults to '/assets/models/movenet/v1'
  modelVersion?: string,      // defaults to value embedded in build config
  targetFps?: 24|30,
  debug?: boolean
}

// deliver a video frame; UI MUST include the relative timestamp (ms)
{ type: 'FRAME', bitmap: ImageBitmap, ts: number }            // preferred (transfer [bitmap])
{ type: 'FRAME_IMAGE_DATA', imageData: ImageData, ts: number } // fallback

// update thresholds without reloading model
{ type: 'CONFIG',
  TH_CONF?: number,               // keypoint confidence threshold (default 0.6)
  DEBOUNCE_MS?: number,           // min time between reps (default 350)
  THETA_DOWN_DEG?: number,        // knee angle threshold to consider "down" (default 100)
  THETA_UP_DEG?: number,          // knee angle threshold to consider "up" (default 160)
  MIN_DOWN_HOLD_MS?: number,      // must hold below down threshold (default 150)
  POSE_LOST_TIMEOUT_MS?: number,   // no-valid-pose window before POSE_LOST (default 500)
  EMA_ALPHA?: number,             // smoothing factor 0.3..0.8 (default 0.5)
  SINGLE_SIDE_PENALTY?: number,   // confidence multiplier when only one leg valid (default 0.8)
}

// stop and dispose resources
{ type: 'STOP' }
```

### 3.2 Worker → UI
```ts
// emitted when a rep completes (hysteresis up-cross)
{ type: 'REP_COMPLETE', ts: number, exercise: 'squat', confidence: number, fps?: number }

// emitted when pose confidence drops below threshold for a window
{ type: 'POSE_LOST', ts: number }

// emitted when pose becomes valid again after POSE_LOST
{ type: 'POSE_REGAINED', ts: number }

// periodic health/telemetry (1 Hz max)
{ type: 'HEARTBEAT', ts: number, fps?: number, backend?: 'webgpu'|'webgl'|'wasm' }

// dev-only: emitted if no frames are received for >2s (for debugging idle pipelines)
{ type: 'WORKER_IDLE', ts: number }

// non-fatal error for logs; UI may show toast and/or attempt a restart
{ type: 'ERROR', ts: number, code: string, message?: string }
```

**Debug-only events:** `WORKER_IDLE` and any future `DEBUG_METRICS` payloads are emitted **only when `debug:true`** is passed at `INIT`. Production builds drop them on the floor; dev builds route them to the on-screen debug HUD (no persistence).

**Timestamp rule:** for any outbound message, set `event.ts = FRAME.ts` of the **triggering frame**. For threshold-based signals (`POSE_LOST`/`POSE_REGAINED`), stamp the `FRAME.ts` where the state change occurred. The worker **never** invents its own timestamps.

---

## 4) Frame transport, buffers & memory
- **Preferred:** UI creates `ImageBitmap` from `<video>` and transfers it with `FRAME`. The worker draws it into an **OffscreenCanvas** for TF.js ingestion (`tf.browser.fromPixels`).
- **Fallback:** if `ImageBitmap` unsupported, UI sends downscaled `ImageData` from a `<canvas>`; worker writes it to OffscreenCanvas.
- **Disposal:** always call `bitmap.close()` after use; wrap per-frame tensors in `tf.engine().startScope()/endScope()` to avoid leaks.
- **Sampling:** throttle to target FPS; **skip** frames if busy; emit **sparse** events only (no per-frame outputs).
- **Explicit frame skip:** if already processing or the time since `lastProcessedTs` is < `1000/targetFps`, **skip** the incoming frame (do not queue).

---

## 5) Keypoint requirements & smoothing
- **Required keypoints for squats:** `left_hip`, `right_hip`, `left_knee`, `right_knee`, `left_ankle`, `right_ankle` with confidence ≥ **TH_CONF**.
- If one side is missing, attempt with the other; if both sides fail, the frame is **invalid** (counts toward POSE_LOST window).
- **Smoothing:** Exponential moving average on knee angles with `EMA_ALPHA` (default **0.5**, configurable via CONFIG; consider 0.3 for smoother/laggy, 0.7 for snappier/noisier); clamp to physical bounds.
- **Single-side fallback & penalty:** If only one leg meets `TH_CONF`, compute angles from that leg but **multiply** final rep `confidence` by `SINGLE_SIDE_PENALTY` (default **0.8**) to reduce false positives.

---

## 6) Squat rep detection algorithm (MVP)
**Overview:** detect transitions between **UP** and **DOWN** using knee joint angle hysteresis with debounce/hold guards.

### 6.1 Angles
- Compute knee angle for each leg `θ_left`, `θ_right` at the **knee** using vectors `(hip→knee)` and `(ankle→knee)`. Angle domain is **0..180°** where ~180° ≈ fully extended.
  - **180°** ≈ fully extended (standing)
  - **90°** ≈ right angle (deep squat)
  - **0°** ≈ heel touching glute (theoretical lower bound)
- Use `θ = min(θ_left, θ_right)`; apply EMA smoothing → `θ̂`.

### 6.2 Thresholds (defaults; tunable via CONFIG)
- `THETA_DOWN_DEG = 100°` → considered **DOWN** when `θ̂ ≤ 100`.
- `THETA_UP_DEG = 160°`   → considered **UP** when `θ̂ ≥ 160`.
- `MIN_DOWN_HOLD_MS = 150` → must stay below `THETA_DOWN_DEG` for this duration to confirm **DOWN**.
- `DEBOUNCE_MS = 350` → minimum time between consecutive reps.
- `TH_CONF = 0.6` → per-keypoint confidence threshold.

These values align with the domain definition above: 160° confidently "UP", ≤100° considered sufficiently "DOWN" for a valid squat depth.

### 6.3 State machine
```
States: { NO_POSE, UP, DOWN }

Start in NO_POSE.
- If frame valid (required keypoints ≥ TH_CONF) and `θ̂ ≥ THETA_UP_DEG` → state := UP.
- If state == UP and `θ̂ ≤ THETA_DOWN_DEG` for ≥ MIN_DOWN_HOLD_MS → state := DOWN.
- If state == DOWN and `θ̂ ≥ THETA_UP_DEG` and time_since_last_rep ≥ DEBOUNCE_MS →
    emit REP_COMPLETE (ts = triggering FRAME.ts), update last_rep_ts, state := UP.
- Any invalid frame resets the **hold** timers but does not force state to NO_POSE immediately.
```

### 6.4 Pose lost/regained
- Maintain `last_valid_ts` (FRAME.ts of last valid frame). If `now - last_valid_ts ≥ POSE_LOST_TIMEOUT_MS` (default 500 ms) and not already lost → emit `POSE_LOST`.
- When a valid frame is processed after POSE_LOST, emit `POSE_REGAINED` and re-enter UP/DOWN based on current `θ̂`.

### 6.5 Optional composite depth guard (future)
- For noisy scenes, add a secondary check: hip y below knee y at bottom. Not required for MVP; leave behind a feature flag.

---

## 7) Runtime loop (pseudo)
```
INIT → resolve modelBaseUrl (default '/assets/models/movenet/v1') → fetch manifest/weights → load model & select backend → warmup → send HEARTBEAT
FRAME(ts)
  if (processing || (ts - lastProcessedTs) < (1000/targetFps)) return // explicit skip
  processing = true; lastProcessedTs = ts
  → to OffscreenCanvas → tf.fromPixels → model.predict → keypoints
    → validate required keypoints (≥ TH_CONF)
    → compute θ_left/right → θ = min → smooth θ̂ (EMA_ALPHA)
    → update state machine (UP/DOWN) & timers → maybe emit REP_COMPLETE
    → update pose-lost/regained logic → maybe emit POSE_LOST/REGAINED
    → every ~1s emit HEARTBEAT { fps, backend }
  → dispose tensors, bitmap.close(); processing = false
CONFIG → update thresholds/constants
STOP → dispose model & exit
```

---

## 8) Errors & resilience
- **Model load failure:** post `{ type:'ERROR', code:'MODEL_LOAD' }`; UI may attempt one restart; if still failing, surface a toast and halt the session (auto-converting to Timed-only is deferred post-MVP).
- **Bad frame payload:** post `{ type:'ERROR', code:'FRAME_DECODE' }` and skip frame.
- **Backend fallback:** if WebGPU init fails, fall back to WebGL; else WASM.
- **Watchdog:** if no frames received for **2s**, emit HEARTBEAT with low FPS; do **not** emit POSE_LOST solely for inactivity.
- **Idle debug signal (dev builds):** if no frames for >2s, emit `WORKER_IDLE` (dev-only) alongside low-FPS HEARTBEAT.

---

## 9) Debug & telemetry (dev builds only)
- Emit `HEARTBEAT` at ≤1 Hz with `{ fps, backend }`.
- If `debug:true` at INIT, every 500 ms (max) also post a tiny debug payload:
  `{ type:'DEBUG_METRICS', ts, theta: θ̂, state, valid: boolean }` (no keypoint arrays).
- Do not ship DEBUG_METRICS in production builds.

---

## 10) Acceptance criteria (Pose Worker)
**Accuracy**
- **≥95%** correct counts for squats across: (a) bright front-on, (b) side angle, (c) evening lamp; **0 double-counts** on bottom bounce.

**Latency & throughput**
- End-to-end per-rep event emission occurs on the **triggering frame**; Practice per‑rep audio plays **<150 ms** after `REP_COMPLETE`.
- Worker sustains **24–30 fps** on modern phones; gracefully skips frames under load.

**Robustness**
- Emits `POSE_LOST/REGAINED` per rules; doesn’t flap at thresholds (MIN_DOWN_HOLD_MS mitigates).
- On bad frames/errors, continues processing subsequent frames without crashing.

**Privacy & memory**
- No frames or keypoint arrays stored or sent to server; `bitmap.close()` is called; tensors are properly scoped.

---

## 11) Interfaces & wiring
- The Worker speaks the message protocol above and integrates with:
  - **Event Bus / Engine** via UI adapters that transform worker messages into **11-event-loop** events.
  - **Voice Driver:** only indirectly (UI subscribes to REP_COMPLETE and speaks in **Practice** mode).
- Implement behind a `PoseProvider` interface so providers can be swapped without touching Engine/UI.

---

## 12) Open items
- **Partial squat accommodation:** post-MVP calibration flow to adapt `THETA_DOWN_DEG` to user range; MVP uses static thresholds with runtime CONFIG for manual tuning.
- Angle thresholds may need per-device tuning; expose a hidden `/debug` panel for CONFIG.
- Consider adding **hip-vs-knee height** composite check if accuracy dips on wide stances.
- Investigate WebNN/WebGPU perf in 2025 browsers; keep fallback path stable.
