

# Workout Engine — Spec (MVP v1)
**Doc:** 13-workout-engine-spec.md  
**Updated:** 2025-08-17 (JST)  
**Scope:** Pure state machine + side‑effect ports that consumes events from the **Event Bus** and produces deterministic UI/voice/storage effects for **Circuit (Timed)** and **Practice (Counted)**.

> This spec pairs with **11‑event‑loop‑spec.md** (event shapes & ordering), **12‑pose‑worker‑spec.md** (squat detection), and **10‑architecture‑overview.md** (ports & performance). It is written for implementation as a pure reducer with thin adapters so it’s easy to unit‑test and replay logs.

---

## 1) Responsibilities & non‑goals
**Responsibilities**
- Own the **session lifecycle** and per‑set state; translate sparse events into derived state.
- Emit **side‑effect intents** (voice cues, storage commits, UI updates) at **well‑defined points**.
- Guarantee **determinism and replayability** (same inputs → same outputs).

**Non‑goals (MVP)**
- Real‑time CV logic (owned by worker).  
- LLM calls during sets (never).  
- Multi‑user sync; networking beyond storage flushes.

---

## 2) Ports (drivers) & purity
Implement the engine as a pure function and route effects via ports:

```ts
// reducer signature
reduce(state: EngineState, event: BaseEvent): { state: EngineState, effects: Effect[] }

// effect union (handled by adapters)
type Effect =
  | { type:'VOICE', cue: VoiceCue }
  | { type:'UI', patch: Partial<UiDerived> }
  | { type:'STORAGE_SET', row: WorkoutSetRow }
  | { type:'STORAGE_SESSION', row: WorkoutSessionRow, xp_delta: number }
```

Adapters consume effects:
- **Voice adapter:** maps `VoiceCue` to Web Audio/SpeechSynthesis.
- **Storage adapter:** writes rows idempotently and updates **companion_state** with `xp_delta`.
- **UI adapter:** applies derived state (timers, counters, banners).

The reducer **must not** call platform APIs directly.

---

## 3) Inputs at session start
On `WORKOUT_START` the engine receives:
- `session_id: UUIDv4` (from UI; same across the session)
- `mode: 'circuit' | 'practice'`
- **Plan** object (immutable):
  - **Circuit:** `{ slots: Slot[]; work_sec: 45; rest_sec: 15 }` where `slots.length===7` and each `Slot = { exercise: Exercise }` in the order defined by **01‑vision‑mvp.md**.
  - **Practice:** `{ exercise: 'squat', max_duration_sec: 300 }` (AMRAP cap).
- `sessionStartTs` (UI timebase, relative ms) for consistency with incoming `ts`.

The engine stores the plan; it does **not** compute plans.

---

## 4) Engine state (shape)
```ts
interface EngineState {
  phase: 'idle'|'countdown'|'active_set'|'rest'|'complete'|'paused';
  mode: 'circuit'|'practice'|null;
  session_id: string|null;          // UUID v4
  session_start_ts: number|null;     // relative ms

  // slot/set tracking
  set_index: number;                 // 0‑based within session; increments for every set started
  slot_index: number|null;           // 1..7 for circuit; null otherwise
  exercise: Exercise|null;
  target_type: 'time'|'reps'|null;
  goal_value: number|null;           // seconds for time; null for practice AMRAP
  max_duration_sec?: number|null;    // practice only

  // live aggregates (reset per set)
  seconds_elapsed: number;           // int
  seconds_left: number;              // int (circuit only)
  actual_reps: number;               // visual reps for squats in circuit; counted in practice

  // flags
  session_halted: boolean;           // fatal error encountered; no further progression
  worker_available: boolean;         // heartbeat from worker in last 2s (UI supplied)
  fallback_timed: boolean;           // practice fallback path active

  // UI banners
  banner: null|{ type:'pose_lost'|'session_error'|'offline_queue_full'|'debug_overflow' };

  // immutable plan reference (not mutated by reducer)
  plan: CircuitPlan|PracticePlan|null;

  // debug
  debug_dropped_events: number;      // exceeded buffer policy
}
```

Derived UI state (`UiDerived`) contains items like timers, big counters, next move name; it is computed from `EngineState` and emitted as `UI` effects when changes occur.

---

## 5) Event handling — transitions & effects
### 5.1 Allowed events by phase
| Phase | Allowed events (ignored otherwise) |
|---|---|
| idle | WORKOUT_START |
| countdown | COUNTDOWN_TICK, PAUSE, STOP |
| active_set | INTERVAL_TICK (circuit), REP_COMPLETE (practice & circuit‑squat visual), POSE_LOST/POSE_REGAINED, PAUSE, STOP |
| rest | INTERVAL_TICK (for rest timer handled by UI or timer source), PAUSE, STOP |
| complete | WORKOUT_START (new session) |
| paused | RESUME, STOP |

> The engine ignores out-of-phase events but may emit a `UI` debug patch. When `session_halted` is true (fatal error), subsequent events are acknowledged with no new effects.

### 5.2 Transition table (core)

**Legend:** V = Voice effect, U = UI patch, S = Storage effect

| From → To | Trigger | State changes | Effects |
|---|---|---|---|
| idle → countdown | `WORKOUT_START(mode, plan)` | init session fields; set_index=0; slot_index=1 (circuit) | U: show countdown; V: countdown cue (3..2..1) |
| countdown → active_set | `COUNTDOWN_TICK(seconds_left:1)` | start first set: exercise, target_type, goal_value/sec_left | U: start timer/counter; V: "Go" |
| active_set (circuit) → active_set | `INTERVAL_TICK` | seconds_elapsed++, seconds_left-- | V: halfway & last‑5s when thresholds hit; U: timer update |
| active_set (practice) → active_set | `REP_COMPLETE` | actual_reps++ | V: number (drop‑latest), milestones at 10/20; U: counter update |
| active_set → rest | time goal reached OR `reason:user_stop` | finalize set aggregates; set_index++ | S: STORAGE_SET; V: "Rest {rest_sec}s"; U: rest timer |
| rest → active_set | rest timer over | set slot_index++ (circuit); load next exercise; reset per‑set fields | U: next move intro; V: next move name |
| last set → complete | after final rest or time completion | finalize session; clear per‑set | S: STORAGE_SESSION (+xp_delta); U: summary view |
| any → paused | `PAUSE` | phase='paused' | V: (mute); U: pause UI |
| paused → previous | `RESUME` | restore previous phase | U: resume UI |
| any → complete | `STOP` | finalize current set (reason user_stop) then session | S: STORAGE_SET (if in set), STORAGE_SESSION; U: summary |

**Notes**
- In **Circuit**, `REP_COMPLETE` **never** produces voice; for **squats** only, it increments `actual_reps` for **visual** display; for other exercises, it is ignored.
- In **Practice**, `INTERVAL_TICK` is not required (engine may track elapsed using event `ts` deltas); rep counting governs progress; `max_duration_sec` enforces cap.

### 5.3 Fallback & fatal error handling
- **Worker failure in Practice:** if UI signals worker restart failed, set `fallback_timed=true`, compute `remaining = max(0, max_duration_sec - seconds_elapsed)`, and treat remainder like Circuit time set (voice = time cues only). Mark final `SET_COMPLETE.reason='error'`.
- **Fatal dispatch error:** on `ENGINE_ERROR` (codes such as `dispatch_failed`), set `session_halted=true`, freeze timers/reps, emit a `UI` patch with `banner:'session_error'`, and stop producing voice/storage effects. Halting keeps behaviour aligned with the MVP's "toast + restart" policy; automated timed fallback is post-MVP.

---

## 6) Storage contract & idempotency
### 6.1 Set writes
Emit `STORAGE_SET` on each set boundary with:
```ts
row = {
  session_id,
  set_index,                // 0-based; unique with (session_id, set_index)
  exercise,
  target_type,              // 'time'|'reps'
  goal_value,               // seconds for time; null for practice
  actual_reps,              // 0 when rep counting not implemented (MVP: all non‑squat timed)
  duration_sec,
}
```
Adapter must upsert with `(session_id, set_index)` unique constraint.

### 6.2 Session write & XP
On `WORKOUT_COMPLETE`, emit `STORAGE_SESSION` with:
```ts
row = {
  session_id,
  started_at, ended_at,          // wall clock from UI when stored
  workout_type: mode,            // 'circuit'|'practice'
  total_reps, duration_sec
}
```
Include `xp_delta` per **01‑vision‑mvp.md** rules (e.g., +10 circuit, +5 practice ≥30 reps, +1 per extra 25 reps). Adapter updates `companion_state` atomically with the session row.

### 6.3 Offline & retries
- Storage adapter queues aggregates in IndexedDB when offline; engine does not change behavior.
- Idempotency across retries guaranteed by `(session_id, set_index)` and `session_id` for sessions.

---

## 7) Voice cues (intent contract)
The engine emits **intentful** `VOICE` effects; the adapter maps to concrete phrases (see **01‑vision‑mvp.md §5.2**).

**Circuit (Timed):**
- Countdown (3,2,1), Go!
- Halfway (work_sec/2)
- Final five seconds
- Rest start (rest_sec) and **Next move intro** at rest start

**Practice (Counted squats):**
- Per‑rep numbers on `REP_COMPLETE` (drop‑latest policy)
- Milestones at 10, 20 (configurable)

> No LLM voice during sets. All LLM interactions happen after set/session via separate adapters.

---

## 8) Derived UI (`UiDerived`) contract
Emit `UI` patches when these change:
- **Timers:** `seconds_left`, `seconds_elapsed`, `phase`, `rest_remaining`.
- **Counters:** `actual_reps` (practice and circuit‑squats visual).
- **Labels:** `exercise`, `next_exercise` (circuit), banners.
- **Progress:** set index/7, overall session progress.

The adapter performs minimal diffing before committing to React state.

---

## 9) Determinism, ordering & replay
- The engine uses only event payloads + current state; it must not read wall clock.
- Ordering is by `(ts, seq)` per event‑loop spec; events outside allowed phases are ignored.
- **Replay:** feeding a recorded JSON event log must yield identical Storage rows and identical Voice cue schedule.

---

## 10) Edge conditions & guards
- **Pause:** timer halts; VOICE muted; REP_COMPLETE ignored until RESUME.
- **POSE_LOST:** does not auto‑pause; allows time to continue; a UI banner may be requested.
- **Background tab:** ticks may coalesce; engine tolerates missing `INTERVAL_TICK` and uses `ts` deltas to keep `seconds_elapsed` accurate (±100 ms).
- **Buffer overflow:** if UI flags event buffer overflow, engine sets `banner=debug_overflow` but continues.
- **Session restart:** from `complete`, `WORKOUT_START` initializes a fresh state.

---

## 11) Reducer pseudocode (informative)
```ts
switch (event.type) {
  case 'WORKOUT_START':
    return startSession(state, event);
  case 'COUNTDOWN_TICK':
    return onCountdown(state, event);
  case 'SET_STARTED':
    return onSetStart(state, event);
  case 'INTERVAL_TICK':
    return onIntervalTick(state, event);
  case 'REP_COMPLETE':
    return onRepComplete(state, event);
  case 'SET_COMPLETE':
    return onSetComplete(state, event);
  case 'WORKOUT_COMPLETE':
    return onWorkoutComplete(state, event);
  case 'PAUSE':
    return onPause(state, event);
  case 'RESUME':
    return onResume(state, event);
  case 'STOP':
    return onStop(state, event);
  case 'POSE_LOST':
  case 'POSE_REGAINED':
    return onPoseState(state, event);
  case 'ENGINE_ERROR':
    return onEngineError(state, event);
  default:
    return { state, effects: [] };
}
```

---

## 12) Acceptance criteria (Engine)
**Determinism & replay**
- Given the same ordered event log, engine emits the **same sequence of effects** and produces identical storage rows.

**Latency & cadence**
- Voice cue intents fire within the first engine pass after the triggering event; per‑rep voice in Practice feels immediate (<150 ms end‑to‑end with adapters).

**Correctness**
- Circuit: exact timer behavior (halfway, final‑5s) at ±100 ms; non‑squat sets store `actual_reps=0`; squat sets store visual reps with no voice.
- Practice: reps increment only on `REP_COMPLETE`; set ends on user stop or `max_duration_sec` cap.

**Robustness**
- PAUSE/RESUME behaves as specified; engine tolerates missing ticks and worker restarts.
- Fatal `ENGINE_ERROR` events halt the session, set the error banner, and avoid emitting additional storage/voice effects.

---

## 13) Test vectors (unit/e2e)
1) **Circuit slot (squats)** — verify countdown, time cues, `actual_reps` increments from worker but no voice for reps; set row has `target_type:'time'` and duration 45.
2) **Circuit non‑squat** — deliver stray REP_COMPLETE; ensure ignored and `actual_reps=0`.
3) **Practice 15 reps** — ensure numbers 1..15 voiced, milestones at 10/20, correct set/session rows.
4) **Practice worker crash** — switch to fallback timed with remaining cap; no per‑rep voice; `SET_COMPLETE.reason='error'`.
5) **Pause/Resume** — pause mid‑set stops timers & voice; reps during pause ignored.
6) **Replay log** — re‑run recorded events; assert identical storage/voice intents.

---

## 14) Open items
- Exact `xp_delta` mapping may evolve; keep adapter pure and data‑driven.
- Whether to show **visual squat count** in Circuit is a UI flag; engine provides the number regardless.
- Consider surfacing per‑device tuning for Practice thresholds through a dev panel.
