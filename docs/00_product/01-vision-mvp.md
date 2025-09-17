# AI-Powered HIIT Companion — Vision & MVP (v1)
**Doc:** 01-vision-mvp.md  
**Updated:** 2025-08-17 (JST)  
**Owner:** Steven (solo dev)  

## 1) Product vision (one page)
Build a **mobile web** (PWA) fitness coach that makes home **bodyweight HIIT** feel like a game. A friendly **AI companion (young female persona)** chats between sets and **speaks during workouts**, while the phone camera **counts reps in real time**. The app rewards consistency with a simple **affinity/level system**, turning progress into an RPG-like bond.  
**Why now:** On-device CV is fast enough on modern phones, and lightweight LLM usage enables personality without high cost.

### Goals
- **Engagement over charts:** Motivation via **companion + progression**, not just metrics.
- **Fast, private, cheap:** All pose estimation **on-device**; minimal network; keep ops **<= $10/mo**.
- **Portfolio-ready:** Clean architecture, crisp demo, extensible for multi-user/social later.

### Non-goals (MVP)
- No multi-user auth/social/leaderboards.
- No complex form coaching (post-set tips only).
- No wearable/HealthKit integrations.
- No monetization/subscriptions.

## 2) Target user & context
- **User:** Solo developer, senior full‑stack; wants an engaging coach to drive short HIIT at home.
- **Device:** Recent iOS/Android phone, modern mobile browser (Chrome/Safari).
- **Setting:** Small indoor space; variable lighting.

## 3) MVP scope (final)
### Must‑have features
1. **Workouts:** **2 curated micro‑HIIT circuits** (7‑minute) with **timed intervals** for each movement (user adjusts intensity).  
2. **Real‑time rep counting:** Reliable **squat** counter (v1); optional **push‑ups** if time permits.  
3. **Voice during circuits:** **time‑based cues only** (countdown, halfway, last 5s); **no per‑rep speech** during circuits.  
4. **AI companion (between sets):** Short **LLM summaries** (praise + one gentle tip).  
5. **Coach Talk (micro‑chat):** Optional **pre/post‑workout one‑turn** chat with quick‑reply chips; **affinity‑conditioned tone**; hard token caps & schema‑validated JSON; **no long‑term memory**.  
6. **Practice mode (single‑exercise):** AMRAP for **squats** with **per‑rep audio** and live counter; other exercises run **timed** until counters exist.  
7. **Progression:** **Linear affinity/level** (+XP per workout; level‑up lines).  
8. **Persistence:** Sessions + affinity in **Supabase Postgres (Micro plan)**.  
9. **PWA:** Installable; offline shell; privacy copy (“no video leaves device”).

#### Exercise modes & initial library (MVP)
- **Exercise modes:**
  - **Circuit (timed):** all movements are timed; no per‑rep speech. Squats may display a **visual** live rep counter (no voice) for encouragement.
  - **Practice (counted):** single exercise AMRAP; **per‑rep audio** for squats in MVP.
- **Circuits (MVP):**
  1) **Circuit 1 — Full Body (7‑min):** squats → burpees → mountain climbers → high knees → push‑ups (timed segments).
  2) **Circuit 2 — Core/Cardio (7‑min):** mountain climbers → side plank dip → seated knee tuck → up‑down plank → Russian twist (timed segments).
- **Initial counted support:** **Squats** only (robust).
- **Labeling:** Each card clearly shows **[Circuit — Timed]** or **[Practice — Counted]** to set expectations.

#### Canonical timing defaults (MVP)
- **Format:** **EMOM‑7** (7 × 60s slots; **45s work / 15s rest** default).
- **Slot map (Circuit 1):** 1 **Squats** → 2 **Burpees** → 3 **Mountain climbers** → 4 **High knees** → 5 **Push‑ups** → 6 **Squats** → 7 **Burpees**.  
- **Slot map (Circuit 2):** 1 **Mountain climbers** → 2 **Side plank dip** → 3 **Seated knee tuck** → 4 **Up‑down plank** → 5 **Russian twist** → 6 **Mountain climbers** → 7 **Side plank dip**.
- **Intensity dial (MVP):** single preset 45/15. (Expose 40/20 and 30/30 post‑MVP.)

#### Affinity & XP rules (MVP)
- **XP earning:** +10 XP per completed circuit; +5 XP per Practice session ≥ 30 reps; +1 XP per additional 25 reps in Practice.
- **Levels:** linear thresholds every **100 XP** (L1=0–99, L2=100–199, …).
- **Effects:** tone softens at **L3+**, playful lines unlocked at **L5+**, 1 new level‑up line per level.
- **Level‑up moment:** one scripted line + lightweight confetti; non‑blocking.
- **Acceptance:** level increases **once** per session write; idempotent on retries.

### Nice‑to‑have (only if time remains)
- Push‑ups counter (if not in MVP).  
- Simple history view (timeline).
- Basic avatar image for coach.

### Explicitly deferred (post‑MVP)
- Auth/multi‑user; leaderboards/challenges/streaks.  
- BlazePose 3D/world coordinates + real‑time form coaching.  
- Gemini Live/streaming voice; long‑term memory/RAG.  
- Native wrappers (Expo/Ionic); wearables; nutrition.

## 4) Experience principles
- **Hands‑free during sets:** Big counter, minimal UI, **instant voice**; no LLM round‑trip mid‑set; during circuits, time cues only; in practice, rep cues aloud.  
- **Delight after effort:** Level‑up moments, short personalized praise.  
- **Clarity & trust:** Explain what’s tracked; never upload video; allow pause/stop anytime.

### Expected usage & user journey (MVP)

**A) Circuit workout (timed)**
1) Home → Select **Circuit 1** or **Circuit 2** (both labeled **Timed**).  
1b) *(Optional)* Tap **Coach Talk** for a **one‑turn pep talk** (chips: “Low energy”, “Motivated”, “Sore”, “No time”).  
2) Countdown (3‑2‑1) primes audio; brief form tip for the first move.  
3) Active set (timed): timer + periodic cues (“Halfway”, “5 seconds left”); **no per‑rep speech**. Squats (if present) may show a **visual** rep count.  
4) Rest: timer with optional tip.  
5) Loop to complete ~7 minutes.  
6) Finish: session saved; **+XP**, possible level‑up; **LLM** praise + 1 tip; *option to reply once via **Coach Talk***; local summary.

**B) Practice mode (counted)**
1) Home → **Practice** → pick an exercise (MVP: **Squats**).  
2) Immediate per‑rep audio (“1…2…3”), big counter; no LLM calls mid‑set.  
3) Stop when done; save AMRAP count; **+XP**; optional short **LLM** praise.  
4) *(Optional)* **Coach Talk** one‑turn message (“Any tips for squats today?”).

### Accessibility & safety (MVP)
- 44px touch targets; high‑contrast color tokens; captions toggle for voice cues.
- **Vibration API** (`navigator.vibrate(100)`) for final 5s cues.
- Onboarding card: **space/lighting** tips; “stop if you feel pain”; “not medical advice.”

## 5) Architecture snapshot (see /docs/system)

- **Frontend (React + TS, PWA):** Camera + **Pose Worker** (TF.js/MediaPipe) in a **Web Worker**; **Event Bus** → **Workout Engine** → Voice & Storage.  
- **Voice:** Circuits → **time‑based cues only**; Practice → **per‑rep audio** for squats. Prefer Web Audio **preloaded numbers 1–50**; fallback **SpeechSynthesis**; autoplay gating after user tap.  
- **Backend:** Minimal serverless endpoints (Vercel/Supabase Edge) for **/api/summary** and **/api/coach-talk** (both schema‑validated, token‑capped) plus optional metrics.  
- **AI model:** **Gemini 2.5 Flash‑Lite** for post‑set/workout **summary** and optional **Coach Talk** (one‑turn); token‑capped JSON `{praise, tip}` / `{message}`.  
- **Data:** Supabase Postgres tables: `companion_state`, `workout_sessions`, `workout_sets` (optional `rep_events` for debug).  
- **Privacy:** No frames/keypoints stored; only aggregates/derived events.

### Coach Talk — contract (MVP)
- **Entry points:** **pre‑workout** and **post‑workout** only (quick‑reply chips + optional free text).
- **Chips (MVP):** `Low energy`, `Motivated`, `Sore`, `No time`.
- **Prompt context:** `{ level, last_workout_summary?, chip, free_text? }` with “no medical advice” rule.
- **Output schema:** `{ "message": string }` (≤ 120 tokens).
- **Rate limits:** ≤ **2 calls/session**, **p95 ≤ 2s**, fallback to canned lines on timeout.

### Voice phrase catalog (MVP)
**Circuits (timed only)**
- Countdown: “3, 2, 1 — go!”
- Halfway: “Halfway, keep pace.”
- Final 5s: “5…4…3…2…1 — rest.”
- Rest start: “Rest 15 seconds.”
- Next move intro: “Next: {exercise}.”

**Practice (counted squats)**
- Numbers **1–50** preloaded.
- Milestones: “That’s 10!”, “That’s 20!”, “Great pace!”, “Nice depth!”
**Rules:** never overlap speech; drop‑latest policy; if autoplay blocked → large visual cues + optional vibration.

## 6) Event‑driven workout loop
- **Producers:** Pose Worker (`rep_complete`, `pose_lost/regained`), Timer (`countdown_tick`, `interval_tick`), UI (`pause/resume/stop`).  
- **Bus:** Small, typed events (sparse, not per‑frame).  
- **Consumers:** Engine (state), Voice Driver (speak), Buffer/Storage (flush on set/workout end).  
**Benefits:** Smooth UI, offline resilience, testability via event log replay, cost control.

## 7) Acceptance criteria (gate to “MVP done”)

### Reliability
- Complete one workout entirely **offline** (PWA cached); data **flushes** on next online open.  
- If TTS blocked, visible counter + optional vibration; no console errors.  
- No raw video or full keypoint arrays written to storage.

### AI & cost
- Post‑set/workout summary: **max 180 output tokens**; daily cap & retry/backoff; cached canned lines when quota hit.  
- Persona safe‑prompt: encouraging, **no medical advice**, 2 sentences max.  
- No LLM calls during active sets; **Coach Talk** allowed **pre/post** only; summaries only post‑set/workout.  
- **Coach Talk:** ≤ 2 calls per session; ≤ 120 output tokens; response ≤ 2s p95; graceful fallback to canned lines on timeout/quota.

### Performance
- **Local metrics (debug):** avg FPS, % low‑confidence frames, per‑rep audio latency p95, token count per summary, **TTS blocked** flag.
- **Storage:** disabled by default; when enabled, aggregate only (no frames/keypoints).
**Accuracy & latency**
- **Squat counter ≥ 95%** correct across:  
  (a) front‑on bright room, (b) side angle bright room, (c) evening warm lamp.  
- **Zero double‑counts** on bottom “bounce.”  
- **Per‑rep audio latency < 150 ms** from `rep_complete` to audible count on mid‑tier Android/iPhone.  
- **Timed moves:** interval timers accurate to ±100 ms; voice cues at halfway and last 5 s.  
- **Practice mode:** per‑rep audio latency < 150 ms; UI counter matches audio; no dropped counts at normal pace.

## 8) Milestones (10‑day target)
1. **Day 0‑1 — Setup:** PWA scaffold, camera permission, Supabase project, `/api/summary` stub.  
2. **Day 2‑4 — Pose + Counter:** Worker‑based MoveNet/2D; squat hysteresis/thresholds; 95% accuracy.  
3. **Day 5‑6 — Voice + Loop:** Preloaded numbers + SpeechSynthesis fallback; countdown/rest cues; event bus + engine paths.  
4. **Day 7‑8 — LLM + Affinity:** Flash‑Lite summary (schema JSON), XP/level, level‑up lines.  
5. **Day 9‑10 — Storage + Offline:** Session/set persistence; service worker caching; privacy page; device smoke tests.

## 9) Risks & mitigations
- **Autoplay/TTS quirks (Safari):** Prime on user tap; fall back to visible counter; ship short cached audio buffers.  
- **Mixed modes confusion (counted vs timed):** Clear **[Counted]/[Timed]** labels; distinct UI treatments; onboarding card explains the difference.  
- **Pose variance (lighting/angles):** Onboarding tips; confidence gating; hysteresis + debounce; fps clamp.  
- **LLM drift/cost spikes:** Strict schema, token caps, daily quota, canned fallbacks, timeouts.  
- **Scope creep:** One‑exercise excellence first; freeze features after Day 2.  
- **Chat creep:** Keep **Coach Talk** to one‑turn with chips; cap frequency; no scrolling chat feed in MVP.

## 10) Success criteria (portfolio/demo)

- Start workout, live rep counting with crisp voice, finish with **personalized praise** and **level‑up** animation, history shows session—**all on a phone**, smooth and private.

### Demo script (portfolio runbook)
1) Open app (PWA badge visible) → tap **Circuit 1** → optional **Coach Talk** pep talk.  
2) Run 2 slots with timed cues; show **visual** squat count when squats appear.  
3) Finish circuit → level‑up moment → short praise/tip.  
4) Switch to **Practice (Squats)** → count aloud to ~15 reps → stop & save.  
5) Open **History** (if implemented) → show today’s session summary.

## 11) References to detailed specs
- `/docs/system/11-event-loop-spec.md` — event types, ordering, consumers, replay guarantees.  
- `/docs/system/12-pose-worker-spec.md` — model, thresholds, debounce, worker messaging.  
- `/docs/system/13-workout-engine-spec.md` — states, transitions, side effects.  

### Full Docs Directory Layout
```
/docs
  /product
    01-vision-mvp.md
  /system
    10-architecture-overview.md
    11-event-loop-spec.md
    12-pose-worker-spec.md
    13-workout-engine-spec.md
    14-voice-driver-spec.md
  /ai
    20-companion-persona-prompt.md
    21-runtime-llm-spec.md
    22-cost-guardrails.md
  /data
    30-data-model.md
    31-storage-policies.md
  /platform
    40-pwa-offline-autoplay.md
    41-perf-and-reliability-budgets.md
    42-compat-matrix.md
  /quality
    50-qa-test-catalog.md
    51-manual-checklists.md
  /ops
    60-dev-workflow-and-ai-playbook.md
    61-adr-template-and-log.md
    62-release-deploy-checklist.md
    63-privacy-safety-copy.md
```