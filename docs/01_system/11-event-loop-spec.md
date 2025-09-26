# Event-Driven Workout Loop — Spec (MVP v1)
**Doc:** 11-event-loop-spec.md  
**Updated:** 2025-08-17 (JST)  
**Scope:** Single-user PWA. Defines event model, payloads, ordering/idempotency, and consumer contracts for **Circuit (Timed)** and **Practice (Counted)** modes.

> This spec is intentionally LLM-friendly: small, typed messages; deterministic rules; replayable logs.

---

## 1) Goals & non-goals
**Goals**
- Keep UI smooth (no per-frame churn), **replayable**, and **offline-safe**.
- Make side effects (voice, storage, UI) **pure functions of events** (+ current state).
- Work identically for **Circuit (Timed)** and **Practice (Counted)**.

**Non-goals (MVP)**
- Real-time form correction events (reserved for post-MVP).
- Multi-user sync or server-sent events.

---

## 2) Timebase, IDs, sequencing, and units
- **Session ID:** `session_id` is a **UUID v4** generated at `WORKOUT_START` on the UI thread; carried in Engine context and included with storage writes.
- **Single timebase:** `sessionStartTs` captured on UI with `performance.now()`. All event `ts` are **relative ms** since start (integer) and computed on **UI**, then passed to sources (e.g., worker) when needed. The worker **echoes** UI-supplied timestamps; it does not keep its own clock. Outbound worker events must carry the `ts` copied from the **triggering** `FRAME.ts`; for threshold-based signals (e.g., `POSE_LOST`/`POSE_REGAINED`), use the `FRAME.ts` where the condition flipped.
- **Sequence numbers:** The Event Bus assigns a **monotonic `seq`** (uint32) on publish. **Wrap is not expected within a session**; ordering is defined by `(ts, seq)` with `ts` taking precedence if wrap is detected.
  - If seq wraps (unlikely): compare by ts first, seq second: `isNewer = (a.ts > b.ts) || (a.ts === b.ts && a.seq > b.seq)`
- **Clock drift:** Since the UI is the single clock, drift between sources is eliminated.
- **Units:** ms for time; seconds in payloads are integers unless otherwise specified.

---

## 3) Event taxonomy
There are **three** categories of events:
1) **System/Control** — user actions and lifecycle.
2) **Workout** — countdowns, ticks, set/workout boundaries.
3) **Sensing** — pose worker signals (reps, pose lost/regained).

### 3.0 Common types
```ts
// Exercises supported in MVP (strings for wire compatibility)
type Exercise =
  | 'squat' | 'burpee' | 'mountain_climber' | 'high_knees' | 'push_up'
  | 'side_plank_dip' | 'seated_knee_tuck' | 'up_down_plank' | 'russian_twist';

type Source = 'ui' | 'timer' | 'worker' | 'engine';

type EventType =
  | 'WORKOUT_START' | 'PAUSE' | 'RESUME' | 'STOP'
  | 'COUNTDOWN_TICK' | 'SET_STARTED' | 'INTERVAL_TICK' | 'SET_COMPLETE' | 'WORKOUT_COMPLETE'
  | 'REP_COMPLETE' | 'POSE_LOST' | 'POSE_REGAINED' | 'HEARTBEAT'
  | 'ENGINE_ERROR'; // diagnostic only

interface BaseEvent {
  type: EventType;
  ts: number;     // ms since sessionStartTs
  seq: number;    // assigned by Event Bus, FIFO within the session
  source: Source;
}
```

### 3.1 System/Control events
```ts
// user intent / lifecycle
{ type: 'WORKOUT_START', ts, seq, source:'ui',
  mode: 'circuit' | 'practice',
  workoutId?: 'circuit-1' | 'circuit-2',
  exercise?: Exercise
}
{ type: 'PAUSE', ts, seq, source:'ui' }
{ type: 'RESUME', ts, seq, source:'ui' }
{ type: 'STOP', ts, seq, source:'ui', reason: 'user' | 'error' }

// diagnostic only (MVP adapters log & surface a toast)
{ type: 'ENGINE_ERROR', ts, seq, source:'engine',
  code: 'dispatch_failed' | 'worker_restart_failed' | 'event_overflow',
  message?: string
}
```

### 3.2 Workout events (engine/timer)
```ts
// pre-set countdown (3..2..1)
{ type: 'COUNTDOWN_TICK', ts, seq, source:'timer', seconds_left: 3 | 2 | 1 }

// workout starts (emitted once per session)
{ type: 'WORKOUT_STARTED', ts, seq, source:'engine',
  session_id: string,
  mode: 'circuit' | 'practice',
  started_at: number // ms since sessionStartTs (mirrors ts)
}

// set begins
{ type: 'SET_STARTED', ts, seq, source:'engine',
  session_id: string,
  mode: 'circuit' | 'practice',
  exercise: Exercise,
  target_type: 'time' | 'reps',
  goal_value: number | null,   // seconds for time; null for Practice AMRAP
  started_at: number,
  max_duration_sec?: number,   // Practice safety cap
  slot_index?: number,         // 1..7 for circuit EMOM-7
  round?: number               // reserved
}

// 1 Hz interval tick during active set (Circuit only)
{ type: 'INTERVAL_TICK', ts, seq, source:'timer',
  seconds_elapsed: number,
  seconds_left: number
}

// set ends
{ type: 'SET_COMPLETE', ts, seq, source:'engine',
  session_id: string,
  mode: 'circuit' | 'practice',
  exercise: Exercise,
  target_type: 'time' | 'reps',
  goal_value: number | null,
  actual_reps: number,        // 0 when rep counting is not implemented for this exercise (MVP: all non‑squat timed moves)
  duration_sec: number,       // actual elapsed secs in set
  reason: 'time' | 'goal' | 'user_stop' | 'error'
}

// workout ends (happy path)
{ type: 'WORKOUT_COMPLETE', ts, seq, source:'engine',
  session_id: string,
  total_reps: number,
  duration_sec: number,
}

// workout ends (user stop / error)
{ type: 'WORKOUT_STOPPED', ts, seq, source:'engine',
  session_id: string,
  total_reps: number,
  duration_sec: number,
  reason: 'user' | 'pose-lost' | 'error'
}
```

### 3.3 Sensing events (pose worker)
```ts
// emitted on hysteresis up-cross (completing one rep)
{ type: 'REP_COMPLETE', ts, seq, source:'worker',
  exercise: 'squat',          // MVP: squats only
  confidence: number,         // 0..1 (threshold defined in 12-pose-worker-spec as TH_CONF)
  fps?: number                // last worker estimate
}

{ type: 'POSE_LOST', ts, seq, source:'worker' }
{ type: 'POSE_REGAINED', ts, seq, source:'worker' }

// periodic health ping (≤1 Hz) for debug HUDs; Engine ignores in production runtime
{ type: 'HEARTBEAT', ts, seq, source:'worker',
  fps?: number,
  backend?: 'webgpu' | 'webgl' | 'wasm'
}

// reserved for post-MVP (not emitted in MVP)
// { type: 'FORM_FLAG', ts, seq, source:'worker', code: 'depth_low' | 'knee_valgus' | ... }
```

**Notes**
- In MVP the worker **emits `REP_COMPLETE` for squats only**. It does **not** emit reps for other exercises.
- In **Circuit** mode, `REP_COMPLETE` **never** triggers voice; the Engine may keep a **visual** rep count **only when `exercise==='squat'`**. For all other Circuit moves, `actual_reps` is stored as **0**.
- `REP_COMPLETE` outside `active_set` is ignored by the Engine (counted only in debug).

---

## 4) Event Bus — implementation contract
- **Library:** custom, minimal typed pub/sub (no RxJS) to keep bundle size down.
- **API:**
```ts
publish<E extends BaseEvent>(e: E): void
subscribe<T extends EventType>(type: T, handler: (e: Extract<BaseEvent, {type:T}>) => void): Unsub
```
- **Ordering:** Bus assigns `seq` and dispatches in **FIFO** per event. Per-type handler order is not guaranteed.
- **Error handling:** Each handler executes inside **try/catch**. Exceptions are logged and a diagnostic `{ type:'ENGINE_ERROR', ... }` may be published; **dispatch continues** for other handlers.
- **Backpressure:** Worker emits **sparse** events only (hysteresis); **no per-frame** traffic. Timer emits 1 Hz ticks. Engine de-duplicates late `INTERVAL_TICK` with the same `seconds_left`.
- **Idempotency & replay:** Consumers must tolerate duplicate `ts`/`seq`. A JSON event log can be **replayed** through the Engine to produce identical summaries (acceptance §8).
- **Error fallback (MVP):** If `publish` encounters an irrecoverable error, surface a non-blocking toast, advise the user to restart, and stop dispatching new events. The automated shift into "Timed Circuit only" returns post-MVP once failure patterns are clearer.

---

## 5) Engine — state machine contract (overview)
States: `idle → countdown → active_set → rest → complete` (+ `paused` overlay)

**Transitions (core):**
- `WORKOUT_START` (mode) → `countdown` → emit `COUNTDOWN_TICK` 3..2..1 → `SET_STARTED` → `active_set`
- In `active_set`:
  - **Circuit (timed):** `INTERVAL_TICK` decrements; **ignore `REP_COMPLETE` for voice**; for squats only, increment `actual_reps` for **visual** display.
  - **Practice (reps):** on each `REP_COMPLETE` → `actual_reps++`; milestone side effects allowed. Practice has a safety cap: `max_duration_sec` (default **300s**). If reached, end set with `reason:'time'`.
  - Set ends on target satisfied or `STOP`/`PAUSE`/error → `SET_COMPLETE`.
- After `SET_COMPLETE`: if more slots → `rest` → next `SET_STARTED`; else `WORKOUT_COMPLETE` → XP/level update side effect.

**Guards & invariants:**
- `PAUSE` stops timer and **mutes** voice; Engine ignores `REP_COMPLETE` until `RESUME`.
- `STOP` from any state triggers graceful `SET_COMPLETE` (reason `user_stop`) then `WORKOUT_COMPLETE`.
- `POSE_LOST` does **not** auto-pause; it only halts rep increments and shows a UI banner (“Step into frame”).
- On worker error/restart failure during **Practice**, switch to **timed fallback** with `remaining = max(0, max_duration_sec - elapsed)`; use Circuit time cues; `SET_COMPLETE.reason='error'` when fallback ends.

---

## 6) Consumers & side effects
### 6.1 Voice Driver
- **Circuits:** speak on `COUNTDOWN_TICK`, `INTERVAL_TICK` (halfway + last 5s), `SET_COMPLETE` (rest), and next-move intro.
- **Practice:** speak **per-rep numbers** on `REP_COMPLETE` with **drop-latest** policy to avoid queueing; milestone callouts at 10/20.
- **Autoplay:** must be primed by user tap; if blocked → show visual cues + optional vibration.

### 6.2 Storage Adapter
- **Events-as-source-of-truth:** adapters now read only `engine:event` payloads; commands are not required for persistence.
- **Flush on boundaries:**
  - On `SET_COMPLETE` → write one `workout_sets` row (queue until `WORKOUT_STARTED` has persisted).
  - On `WORKOUT_COMPLETE` or `WORKOUT_STOPPED` → upsert `workout_sessions` with totals/duration.
- **Idempotency:** Use `(session_id, set_index)` unique constraints; retries safe.
- **Offline queue:** if write fails, enqueue aggregate payloads (set/session) in IndexedDB (cap below); retry on next launch.

### 6.3 UI Renderer
- Subscribe to events to update counters/timers; prefer **derived state** from Engine over raw events.
- For Circuit squats, display **visual** rep count (no audio) sourced from Engine’s aggregate.

---

## 7) Source-specific rules
### 7.1 Timer source
- Emits `COUNTDOWN_TICK` 3..2..1 at 1 Hz, then transitions to `SET_STARTED` via Engine.
- Emits `INTERVAL_TICK` at 1 Hz (Circuit only): includes `seconds_elapsed` & `seconds_left`.
- Drops or coalesces ticks if app is backgrounded; Engine tolerates missing ticks.

### 7.2 Worker source (pose)
- Emits `REP_COMPLETE` only on hysteresis **up-cross**; min **DEBOUNCE_MS** between reps; requires confidence ≥ **TH_CONF** and valid hip+knee keypoints. (Values defined in **12-pose-worker-spec**; defaults TH_CONF=0.6, DEBOUNCE_MS=350.)
- Emits `POSE_LOST` after a quiet period (e.g., 500 ms without valid pose); `POSE_REGAINED` when valid again.
- **Timestamp rule:** For worker → UI events, set `event.ts = FRAME.ts` of the **triggering frame**; for `POSE_LOST`/`POSE_REGAINED`, stamp the `FRAME.ts` of the first frame that satisfies the state change.
- Emits optional `HEARTBEAT` ≤1 Hz with the latest FPS/backend; production adapters may drop it, but dev builds surface the data in the debug HUD.
- Continues running during `PAUSE`, but Engine ignores `REP_COMPLETE`.

---

## 8) Limits, buffers & acceptance criteria
### 8.1 Buffers & quotas
- **In-memory event buffer:** cap **1,000 events/session**. If exceeded, drop oldest **non-boundary** events (never drop `SET_*` / `WORKOUT_*`) and set a debug flag.
- **Offline queue (IndexedDB):** store **aggregate writes only** (sets/sessions), cap **100 sessions**; drop oldest and show a non-blocking banner when near cap. Estimated footprint **<256 KB**.

### 8.2 Determinism & replay
- Replaying a recorded event log (JSON) yields identical `workout_sessions`/**sets** aggregates and the same voice cue schedule.

### 8.3 Latency & cadence
- Practice: **per-rep audio** plays **< 150 ms** after `REP_COMPLETE` on mid-tier devices.
- Circuit: timer accuracy **±100 ms**; halfway and final-5s cues fire as scheduled under load.

### 8.4 Robustness
- Ignoring out-of-state `REP_COMPLETE` does not crash; debug metric increments.
- On worker error/restart mid-set, Engine continues Circuit **timed** behavior and completes set; Practice switches to **timed fallback** as defined; `SET_COMPLETE.reason='error'` if fallback engaged.
- Dispatcher crashes halt the session and show a recoverable error instead of auto-converting to Timed Circuit; automated downgrade is a post-MVP follow-up.

### 8.5 Storage integrity
- No duplicate set/session rows on retries; offline session flushes correctly on next open.

---

## 9) Test vectors (for unit/e2e)
### 9.1 Circuit — one slot
```
WORKOUT_START(mode:circuit, workoutId:circuit-1)
COUNTDOWN_TICK(3) → (2) → (1)
SET_STARTED(ex:squat, target:time, goal:45, slot:1)
INTERVAL_TICK(el:1,left:44) … INTERVAL_TICK(el:22,left:23)
// 3 REP_COMPLETE arrive from worker — Engine updates visual counter only; Voice stays silent for reps
INTERVAL_TICK(el:40,left:5) → cue: "5..4..3..2..1 — rest"
SET_COMPLETE(ex:squat, target:time, reps:3, dur:45, reason:time)
```
**Expect:** voice cues at countdown/halfway/last-5; `workout_sets` row with `actual_reps=3` (visual only), duration 45.

### 9.2 Practice — AMRAP 15 squats
```
WORKOUT_START(mode:practice, exercise:squat)
COUNTDOWN_TICK(3) → (2) → (1)
SET_STARTED(ex:squat, target:reps, goal:null, max_duration_sec:300)
REP_COMPLETE x15 (≥DEBOUNCE_MS apart)
SET_COMPLETE(ex:squat, target:reps, reps:15, dur:~t, reason:user_stop)
WORKOUT_COMPLETE(total_reps:15, duration_sec:~t)
```
**Expect:** numbers 1..15 spoken with <150 ms latency; one set row with 15 reps; XP added per rules.

### 9.3 Practice — worker failure → timed fallback
```
… active_set (practice) … → worker crash → restart fails → fallback timer starts (remaining = 300 - elapsed)
… cues as Circuit (halfway, last-5) … → SET_COMPLETE(reason:error) → WORKOUT_COMPLETE
```
**Expect:** no per-rep audio in fallback; set capped by remaining time; summary persists.

### 9.4 Pause/Resume mid-set
```
… active_set … → PAUSE → (worker still emits REP_COMPLETE) → RESUME → continue → SET_COMPLETE
```
**Expect:** reps during PAUSE ignored; no voice during PAUSE; timers halted.

---

## 10) Open items (handoff to other specs)
- Finalize exact **TS types** for `Event` union (this spec provides shapes; codegen can derive from it).
- Define Engine reducer tables (state × event → new state + effects) in **13-workout-engine-spec.md**.
- Hysteresis thresholds and confidence rules live in **12-pose-worker-spec.md**.

---

## 11) Cross-references
- **10-architecture-overview.md** — rationale for event-driven design, worker comms basics.
- **12-pose-worker-spec.md** — worker inference loop, thresholds, and message posts.
- **13-workout-engine-spec.md** — reducer transitions and side effects.
- **01-vision-mvp.md** — product scope, circuits, voice policies, XP rules.
