# Workout Engine Plan — Event Bus + Test Harness

Updated: 2025-09-24
Scope: Define the MVP workout engine reducer and event bus wiring, and outline a thin test-harness screen to exercise flows before full UI.

## 1) Goals
- Deterministic, testable event-driven core for Practice sessions (squats only in MVP).
- Clear interfaces between Engine ⇄ Pose Worker ⇄ Voice Driver ⇄ Storage.
- A minimal on-device harness screen to drive and observe flows end-to-end.

References: docs/01_system/10-architecture-overview.md, docs/01_system/11-event-loop-spec.md, docs/01_system/12-pose-worker-spec.md

## 2) Architecture Overview
- Event Bus (pub/sub) under `@/services/event-bus` dispatches domain events.
- Workout Engine reducer holds session state and reacts to events/commands.
- Adapters translate external signals:
  - Pose Worker → Engine events (`REP_COMPLETE`, `POSE_LOST`, `POSE_REGAINED`).
  - UI controls → Engine commands (`START_WORKOUT`, `START_SET`, `STOP`, etc.).
  - Voice Driver subscribes to Engine events to speak cues.
  - Storage adapter persists aggregates at set/workout boundaries.

## 3) State Shape (MVP)
TypeScript sketch for reducer state:
```
interface WorkoutEngineState {
  mode: 'IDLE' | 'PRACTICE' | 'PAUSED' | 'COMPLETE';
  sessionId: string | null;
  startedAt?: number;
  endedAt?: number;
  currentSet?: SetState;
  completedSets: SetAggregate[];
  totalReps: number;
  lastEventTs?: number;
}

interface SetState {
  index: number;                 // 0-based
  exercise: 'squat';             // MVP
  targetType: 'reps' | 'time';
  goalValue: number;             // reps or seconds
  actualReps: number;
  startedAt: number;
}

interface SetAggregate extends Omit<SetState, 'actualReps' | 'startedAt'> {
  actualReps: number;
  durationSec: number;
}
```

## 4) Events & Commands
- Commands (UI → Engine): `START_WORKOUT`, `START_SET`, `PAUSE`, `RESUME`, `STOP`, `RESET`.
- External (Pose Worker → Engine): `REP_COMPLETE`, `POSE_LOST`, `POSE_REGAINED`, `HEARTBEAT`.
- Engine Emissions (for Voice/Storage/UI):
  - `WORKOUT_STARTED`, `SET_STARTED`, `REP_TICK`, `SET_COMPLETE`, `WORKOUT_COMPLETE`.

Rules (per 11-event-loop-spec.md):
- On `REP_COMPLETE` in PRACTICE → increment set `actualReps` and `totalReps`; emit `REP_TICK` with ts; complete set/workout on thresholds.
- Persist on `SET_COMPLETE` / `WORKOUT_COMPLETE` via Storage adapter (idempotent, retries offline).

## 5) Reducer Contract
```
interface EngineReducerResult {
  state: WorkoutEngineState;
  events: EngineEvent[];
}

function reduceWorkoutEngine(
  state: WorkoutEngineState,
  message: { kind: 'command'; payload: EngineCommand } | { kind: 'signal'; payload: EngineExternalSignal }
): EngineReducerResult
```

Guidelines:
- Pure function; no side effects. All IO happens in adapters subscribed to Engine emissions.
- Emit domain events through the `events` array; adapters publish them on `engine:event` via the Event Bus.

## 6) Adapters & Wiring
- Event Bus channels: `engine:command`, `engine:event`, `pose:event`, `voice:command`, `storage:command` (voice/storage channels TBD).
- Pose adapter:
  - Creates pose worker via `createPoseWorker()`.
  - Subscribes to worker messages; forwards as `ExternalSignal`s to `engine:in`.
- Voice adapter:
  - Subscribes to `engine:out` for `REP_TICK`, `SET_COMPLETE`, `WORKOUT_COMPLETE` and schedules audio.
- Storage adapter:
  - Subscribes to `engine:out` and writes aggregates to Supabase on boundaries.

## 7) Test Harness Screen
Location: `packages/app/src/features/workout-engine/harness/`.

Components:
- `PracticeHarness.tsx` — page-level container that:
  - Renders controls: Start Workout, Start/End Set, Fake Rep, Auto-Rep start/stop, Pause/Resume, Stop.
  - Shows counters (total reps, set reps), state badges (mode, auto-stream), and debug event log.
  - Includes a Dev HUD area to print recent events. **[initial scaffold complete]**
- `PoseDebugHUD.tsx` — subscribes to pose worker `DEBUG_METRICS`, `HEARTBEAT`.
- `EventLog.tsx` — rolling list of last N engine/pose events.

Camera: start with a placeholder; integrate real media capture when ready to feed the worker.

## 8) Milestones
- M1 ✅ Reducer + Event Bus shell in place; manual buttons produce expected emissions; unit tests cover reducer transitions.
- M2 ✅ Pose adapter connected; fake `REP_COMPLETE` generator for harness; Voice adapter logs would-be playback.
- M3 ◻️ Audio preload worker integrated; simple audio playback for `REP_TICK` in Practice mode.
- M4 ◻️ Storage adapter writes aggregates to Supabase; types generated and used.

## 9) Testing Strategy
- Vitest unit tests for reducer (pure transitions, boundary cases).
- Integration tests for adapters using mocked bus/worker handles.
- Playwright e2e deferred until a stable harness flow exists.

## 10) Acceptance Criteria
- Start → Set → Reps → Set Complete → Workout Complete flow reproducible via harness controls and (later) pose events.
- Emissions align with timestamps from pose worker signals.
- No crashes on rapid command sequences; idempotent persistence on boundaries.

## 11) Out of Scope (MVP)
- Multi-exercise logic (beyond squat).
- Advanced voice coaching and LLM integration.
- Full visual design; harness is functional/debug-first.

## 12) Next Actions
1. ✅ Update `@/services/event-bus` with typed channels for `engine:command`/`engine:event` (complete).
2. ✅ Flesh out reducer + thin engine runtime in `@/features/workout-engine/core`/runtime (rep handling, auto-complete, provider wiring).
3. ✅ Scaffold harness components under `@/features/workout-engine/harness` and wire controls to commands (initial UI live under Practice screen in dev).
4. ✅ Add reducer unit tests (Vitest) and runtime adapter test with mocked bus.
5. ✅ Integrate pose adapter with fake `REP_COMPLETE` generator toggle; real worker later.
