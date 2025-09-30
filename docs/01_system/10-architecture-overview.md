# Architecture Overview — MVP v1
**Doc:** 10-architecture-overview.md  
**Updated:** 2025-08-17 (JST)  
**Scope:** Mobile web PWA for HIIT with on-device pose, time-based circuits, counted Practice mode (squats), and micro-chat "Coach Talk".

---

## 1) System goals & constraints
- **Engagement-first:** Reliable HIIT loop with clear audio cues; crisp per‑rep audio only in **Practice**.
- **Privacy by default:** **No video** or raw keypoints leave device; store only aggregates.
- **Cost ≤ $10/mo:** Pose on-device; token-capped LLM calls **post** set/workout only; minimal serverless.
- **Smooth on phones:** 60 fps UI target; model loop 24–30 fps with frame skipping.
- **Single-user MVP:** No auth; schema and APIs leave room for multi-user later.

Non-goals (MVP): leaderboards, social, 3D form coaching, streaming voice LLM, long-term chat memory.

---

## 2) Component map (high-level)
| Layer | Component | Responsibility | Notes |
|---|---|---|---|
| UI (Main thread) | **App Shell (React/TS, PWA)** | Views (Home, Circuits, Practice, Summary), camera permission flow, mode selection. | Service Worker caches shell+models (see §3.3); powered by React, Vite, TanStack Query, optional Zustand. |
|  | **Event Bus** | Typed pub/sub for sparse domain events (`rep_complete`, `set_complete`, etc.). | No per-frame traffic. |
|  | **Workout Engine (State Machine)** | Drives `idle → countdown → active_set → rest → complete`; emits side-effects. | Pure reducer + side-effect adaptors. |
|  | **Voice Driver** | Schedules **time-based** cues (circuits) and **per‑rep** numbers (Practice). | Web Audio with recorded assets; SpeechSynthesis dev fallback; TTS provider post-MVP. |
|  | **Storage Adapter** | Buffers events → writes `workout_sets`, `workout_sessions`, `companion_state`. | Flush on set/workout boundaries; offline queue. |
| Worker | **Pose Worker** | Runs TF.js/MoveNet; emits `rep_complete`, `pose_lost/regained`. | Knee-angle detection + EMA smoothing + ankle symmetry validation. |
| Edge/API | **LLM Adapter** | `/api/summary` and `/api/coach-talk`; schema-validated JSON; token/time caps. | Vercel Functions or Supabase Edge. |
| Data | **Supabase Postgres (Micro)** | Tables: `companion_state`, `workout_sessions`, `workout_sets` (+ optional `rep_events`). | No auth in MVP; design for later RLS. |
| Platform | **PWA Service Worker** | Offline shell + model caching; cache busting on release. | Respect autoplay policies. |

---

## 3) Data flow at a glance
```
Camera → (UI grants) → <video>  
                 └── frame → **Pose Worker** (TF.js/MediaPipe)
                          └── `rep_complete` | `pose_lost/regained` → **Event Bus**
                                                              ├─ **Workout Engine** (state/aggregates)
                                                              ├─ **Voice Driver** (speak on milestones)
                                                              └─ **Buffer** (in‑memory)
Timer (countdown/interval) ───────────────────────────────────→ **Event Bus**
UI actions (pause/resume/stop) ───────────────────────────────→ **Event Bus**

On `set_complete` → **Storage Adapter** writes `workout_sets`
On `workout_complete` → write `workout_sessions` + update `companion_state` (XP/level)
Post‑workout → **LLM Adapter** `/api/summary` → JSON `{praise, tip}`
Pre/Post → optional **Coach Talk** `/api/coach-talk` → `{message}`
```

### Why event-driven
- Smooth UI (no per‑frame React churn), testable by **event log replay**, offline‑friendly (buffered), and costs bounded (DB writes only at boundaries; no LLM in-set).

---

## 3.1) Worker comms & frame transport
**Goal:** keep UI smooth; avoid copying large pixel arrays.

- **Message protocol:** structured‑clone objects with an explicit "type" field.
  - UI → Worker: { type: "INIT", model: "movenet", targetFps: 24 } 
                   { type: "FRAME", bitmap: ImageBitmap, ts: number } (bitmap transferred)
                   { type: "STOP" }
  - Worker → UI: { type: "REP_COMPLETE", exercise: "squat", ts, confidence }
                 { type: "POSE_LOST" | "POSE_REGAINED", ts }
                 { type: "HEARTBEAT", fps }
- **Frame transport (preferred):** create **ImageBitmap** from `<video>` on UI thread and **transfer** it with the message (transfer list `[bitmap]`). 
  - Worker draws bitmap to an **OffscreenCanvas** and feeds TF.js (via `tf.browser.fromPixels`). 
  - **Dispose**: Worker calls `bitmap.close()` after use to free memory.
- **Fallback:** if ImageBitmap unsupported, send **ImageData** from a downscaled `<canvas>` (structured clone).
- **Sampling:** throttle to target FPS (24–30); **skip** frames when busy; emit only sparse events.
- **Timestamps:** UI stamps each `FRAME` with `ts` (relative ms); worker **must echo** the same `ts` in its output events.

## 3.2) Timebase & IDs

- **Single timebase:** UI establishes `sessionStartTs` via `performance.now()`; all event timestamps `ts` are **relative ms** computed on the UI and passed to sources. The worker **echoes** UI-provided `ts`; it does not keep its own clock.
- **Session ID:** generate a **UUID v4** at `WORKOUT_START`; carry in Engine context; include with storage writes for idempotency.

## 3.3) Model asset hosting & caching
- **Model bundle:** Serve MoveNet weights and metadata from `/assets/models/movenet/v1/` on Vercel with hashed filenames; bump the `vX` directory whenever thresholds change so older caches stay valid.
- **Install-time caching:** During service-worker `install`, pre-cache the model manifest and weights, then activate immediately on success. Hashed filenames give built-in cache busting when we ship new builds.
- **Streaming fallback:** If pre-cache fails, lazily fetch the model on first camera enable and store it in the runtime cache; surface a loading indicator while the worker waits for the download.
- **Warm-up:** After worker `INIT`, run two dry inferences against down-scaled frames before exposing Practice mode so the first counted rep stays under the 150 ms latency budget.
- **Size guardrail:** Keep the total model payload under ~7 MB; if we swap providers, document the new CDN path and update the pre-cache manifest in the same PR.
- **Version pinning:** Record `model_version` in a config object and persist it with workout sessions so accuracy regressions can be tied to model changes.

---

## 4) Mode contracts (overview)
### A) **Circuit (Timed)**
- **Audio:** time‑based only (countdown, halfway, final 5s, rest start, next move). No per‑rep speech.
- **Visuals:** large timer; exercise name; optional **visual** squat rep counter.
- **Events:** `countdown_tick`(1 Hz), `interval_tick`(1 Hz), `set_complete`, `workout_complete`.
- **Storage:** summary rows per set and session.

### B) **Practice (Counted)**
- **Audio:** per‑rep numbers (preloaded) for **squats**; milestone lines (10/20/etc.).
- **Visuals:** big numeric counter; optional skeleton overlay in debug.
- **Events:** `rep_complete` (sparse), `set_complete` (AMRAP end).
- **Storage:** AMRAP reps + duration; XP rules apply.

> Full event types/payloads live in **11‑event‑loop‑spec.md**; this doc only sets the contracts.

---

## 4.1) Event Bus implementation
- **Library:** **custom typed pub/sub** (no RxJS) to keep bundle small; backpressure handled at **sources** (worker/timer).
- **API shape:** `publish(event)`, `subscribe(type, handler)` with a discriminated union Event type.
- **Sequencing:** Bus assigns a monotonic **uint32 `seq`**; order by **(ts, seq)**. Wrap is not expected within a session; if detected, `ts` wins.
- **Ordering:** single consumer loop processes events FIFO.
- **Error handling:** each handler runs inside **try/catch**; exceptions are logged and may emit an `ENGINE_ERROR` diagnostic event; FIFO dispatch **continues**.
- **Safe mode (post-MVP):** For launch, surface errors and prompt the user to restart the session; the auto-degrade-to-timed behavior moves to backlog until we see real failure modes.
- **Backpressure:** worker emits sparse events (hysteresis); timer at 1 Hz; UI drops duplicate `INTERVAL_TICK` if delayed.
- **Reference:** exact types and acceptance live in **11‑event‑loop‑spec.md**.

---

## 5) Concurrency & performance model
- **Threading:** Pose in a **Web Worker**; UI handles rendering, timers, and side effects.
- **Back‑pressure:** Worker emits only on **state transitions** (hysteresis), not every frame.
- **Budgets:**
  - UI frame time ≤ **16 ms** (60 fps goal).  
  - Pose loop target **24–30 fps**; skip frames if < 20.  
  - Per‑rep audio (Practice) **< 150 ms** from `rep_complete` to sound.  
  - Timer accuracy **±100 ms** for cues.
- **Device variability:** dynamically reduce model sampling rate on low FPS; hide visual skeleton by default.

### Error handling & boundaries
- **React Error Boundaries:** wrap Workout/Circuit routes; show retry UI on crash.
- **Worker supervision:** listen for `error`/`messageerror`; **auto‑restart** worker once per session; fall back to **Timed‑only** if re‑init fails.
- **Voice driver errors:** catch/reject on blocked autoplay; switch to visual cues + vibration.

### Memory management
- **Bitmaps:** always call `bitmap.close()` in worker after inference.
- **Canvases:** reuse OffscreenCanvas; avoid creating contexts per frame.
- **Audio:** reuse preloaded **AudioBuffer**; `speechSynthesis.cancel()` on unmount/route change.
- **GC hints:** clear arrays/references after `set_complete`; avoid retaining large debug data.

---

## 6) Storage & offline behavior
- **Buffer-first:** Append events to an in‑memory buffer; aggregate stats live in Engine.
- **Flush policy:** Write only on `set_complete` and `workout_complete` (idempotent). Retry with exponential backoff.
- **Offline queue:** If network down, store pending writes in IndexedDB; flush next app open.

### Limits
- **In‑memory buffer cap:** **1,000 events/session**. If exceeded, drop oldest **non‑boundary** events (never drop `SET_*` / `WORKOUT_*`) and mark a debug flag.
- **Offline queue cap:** store **aggregate writes only** (sets/sessions), cap **100 sessions**; drop oldest and show a banner when near cap (est. <256 KB).
- **Idempotency key:** include `session_id` (UUID v4) and `(session_id, set_index)` unique constraints to make retries safe.

- **Schema (summary):**
  - `workout_sessions(id, started_at, ended_at, workout_type, total_reps, duration_sec)`
  - `workout_sets(id, session_id, exercise, target_type, goal_value, actual_reps, duration_sec)`
  - `companion_state(id=1, affinity_xp, level, updated_at)`

### Migrations
- **Tooling:** use **Supabase CLI** migrations in `/supabase/migrations` (SQL files, timestamped). 
- **Policy:** all schema changes via migrations (no console edits); PR must include up/down SQL. 
- **Dev seeds:** lightweight seed script for local dev; **idempotent** seeding.
- **Service worker tooling:** generate precache/workbox bundle via Workbox CLI (or Vite plugin) to ensure model/audio assets are versioned and cached predictably.

---

## 7) AI integration (runtime)
- **Endpoints:** `/api/summary` (post‑set/workout) and `/api/coach-talk` (micro‑chat pre/post only).
- **Model:** **Gemini 2.5 Flash‑Lite**; schema‑validated JSON; caps per endpoint:
  - **/api/summary:** input ≤ **300** tokens, output ≤ **180** tokens, **p95 ≤ 2s**.
  - **/api/coach‑talk:** input ≤ **300** tokens, output ≤ **120** tokens, **p95 ≤ 2s**; ≤ **2 calls/session**.
  - Hard daily cap via env (e.g., TOKEN_DAILY_CAP); fallback to canned lines on quota/timeout.
- **Context:** `{level, affinity_xp, last_workout_stats?, chip?, free_text?}` + system safety (“no medical advice”).
- **No in‑set calls.** If API fails/timeout → canned lines.

---

## 8) Privacy, security, and config
- **Privacy:** never upload frames or full keypoint arrays; store only aggregates.
- **Secrets:** API keys live server‑side (Vercel/Supabase Edge env); client never holds LLM key.
- **CORS/Origin:** restrict API routes to site origin.
- **Config vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `LLM_API_URL`, `LLM_API_KEY`, `TOKEN_DAILY_CAP`, `TIMEOUT_MS`.
- **Future auth:** design tables for user_id; enable Supabase RLS when multi-user.

## 8.1) Rate limiting
- **Client guards (MVP):** enforce the existing UI caps (1 summary per set/workout, <=2 Coach Talk calls/session) with short-lived local timers.
- **Server logging:** capture aggregate usage in Supabase for manual review; no automated rejection path until real traffic materialises.
- **Post-MVP:** token bucket enforcement and a global circuit breaker move to a future iteration once multi-user support and usage data justify them.

---

## 9) Deployment & environments
- **Frontend:** Vercel (Next/Vite) or Netlify; PWA with versioned assets; SW cache bust on deploy.
- **Edge/API:** Vercel Functions or Supabase Edge Functions (Node/TS).
- **Database:** Supabase Micro (Postgres). Backups enabled.
- **CDN for models:** vendor CDN or app-hosted; pin versions for reproducibility.

### Edge choice: Vercel Functions vs Supabase Edge
- **Default (MVP):** **Vercel Functions** — simplest co‑deploy with frontend; great DX, regional routing.
- **Choose Supabase Edge when:** API must sit close to DB (chatty DB ops), or you want single‑provider infra/policies.
- **Either way:** identical handler contract; keep adapters thin so you can swap later.

---

## 10) Observability (debug-only in MVP)
- **Local HUD (dev builds):** FPS, low-confidence %, per-rep latency p95, TTS blocked flag, token usage.
- **No telemetry** shipped by default; when enabled for tuning, aggregate only.
- **Testing stack:** unit tests with **Vitest**, component/integration with **React Testing Library**, and end-to-end smoke runs via **Playwright** before releases.

---

## 11) Extensibility points
- **PoseProvider interface:** swap MoveNet ↔ MediaPipe ↔ future BlazePose/3D without UI changes.
- **Drivers:** Voice (Web Audio ↔ SpeechSynthesis), Storage (Supabase ↔ file), LLM (Gemini ↔ others).
- **New counted exercises:** add detector module that emits `rep_complete` → rest of app unchanged.
- **Future features:** auth, social, leaderboards, richer chat/memory, 3D form coaching, native wrappers.

---

## 12) Risks & mitigations
- **Autoplay/TTS quirks:** prime on user tap; fallback to visual cues; vibration assistance.
- **Pose accuracy variance:** onboarding tips; confidence gating; hysteresis; fps clamp; optional visual counter only for squats.
- **LLM latency/cost:** hard caps, timeouts, canned fallbacks; **no in‑set calls**.
- **Offline edge cases:** idempotent writes; replayable event log to reconstruct summaries.

---

## 13) Open questions (to resolve in specs)
- Exact **thresholds** for squat hysteresis & debounce (see 12-pose-worker-spec).
- Final **event payloads** & ordering (see 11-event-loop-spec).
- Whether to expose a **visual skeleton** toggle in MVP or only in debug.
- When to reintroduce backend rate limiting and automated safe mode once usage data exposes real failure patterns.

---

## 14) References
- **01‑vision‑mvp.md** — product scope, circuits, XP rules, voice catalog.  
- **11‑event‑loop‑spec.md** — authoritative event types, ordering, consumers.  
- **12‑pose‑worker‑spec.md** — model choice, thresholds, worker messaging.  
- **13‑workout‑engine‑spec.md** — states, transitions, side effects.  
