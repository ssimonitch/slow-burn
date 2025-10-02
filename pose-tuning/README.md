# Pose Heuristic Tuning Plan — Multi-Angle, Multi-Exercise Framework

**Updated:** 2025-09-30
**Scope:** Define a reusable process for gathering, annotating, and analyzing video footage to validate and tune pose detection heuristics across camera angles and exercise types.

---

## 1) Goals

- **Accuracy target:** ≤1 miss or double-count per 20 reps for each supported exercise × angle combination
- **Reusability:** Establish tooling and workflow that generalizes to future exercises (push-ups, lunges, etc.)
- **Validation before scaling:** Tune MoveNet 2D heuristics before considering heavier models (BlazePose 3D, etc.)
- **Regression prevention:** Build automated evaluation harness for CI integration

---

## 2) Exercise Scope & Biomechanical Considerations

### Current: Bodyweight Squats (MVP)
- **Supported angles:** Front, side, back
- **Key biomechanics:**
  - Upright torso (minimal forward lean)
  - Knee angle changes from ~170° (standing) to ~90° (depth)
  - Both feet planted; ankles should remain symmetric
- **Critical validations:**
  - Orientation detection (`detectOrientation()` at `pose.ts:603`)
  - Ankle symmetry check (`areAnklesSymmetric()` at `pose.ts:656`)
  - Knee angle theta calculation (`computeKneeMetrics()` in `poseMath.ts:25`)

### Future Exercises
- Push-ups: different keypoint visibility (front-down vs. side profiles)
- Lunges: asymmetric stance requires single-leg focus
- Burpees: multi-phase movement (requires state machine extensions)

**Exercise-specific tuning:** See `exercise-template.md` for per-exercise documentation template.

---

## 3) Data Collection Strategy

### 3.1 Primary Footage (Bodyweight Exercises)
- **Priority:** Capture **bodyweight** form across all angles
  - Front: camera at chest height, 6-8 feet away
  - Side: perpendicular to movement plane
  - Back: centered on spine, same distance as front
- **Variability matrix:**
  - Lighting: bright (daylight), medium (indoor), low (evening/lamp)
  - Clothing: fitted vs. loose
  - Camera height: floor-level, chest, overhead
  - Rep speed: slow controlled, moderate, fast
- **Target:** 10-15 clean clips per angle (15-25 reps each)

### 3.2 Edge Cases & Supplemental Footage
- **Barbell squats:** Document separately as "edge case" category
  - Forward lean and bar occlusion may trigger different heuristics
  - Use to validate robustness, but **do not tune primary parameters against barbell form**
- **Public datasets:** YouTube workout clips, open-source pose datasets
  - Different body types, environments, camera qualities
  - Archive URLs + timestamps for attribution

### 3.3 Multi-Angle Synchronized Footage (Future)
- Set up tripod rigs to capture front + back simultaneously
- Enables cross-validation of orientation detection and parameter consistency

---

## 4) Annotation Schema & Ground Truth

### 4.1 Lightweight Annotation (Phase 1)
**Format:** CSV at `packages/infra/pose-tuning/annotations/{exercise}-{angle}-{id}.csv`

**Required fields:**
```csv
video_id,exercise,angle,lighting,equipment,ground_truth_reps,notes
squat_front_01,squat,front,bright,bodyweight,18,"clean form, full depth"
squat_back_02,squat,back,evening,bodyweight,15,"slight forward lean at rep 12"
squat_front_03,squat,front,bright,barbell,20,"EDGE CASE: bar occludes shoulders"
```

**Optional fields:** `failure_frames`, `occlusion_timestamps`, `camera_height`

### 4.2 High-Fidelity Annotation (Phase 2+)
For detailed debugging, add per-rep timing:
```csv
video_id,frame_ts_ms,phase,rep_index,notes
squat_front_01,1250,down,1,"good depth"
squat_front_01,1850,up,1,"complete"
squat_front_01,2100,down,2,"slight bounce at bottom"
```

Focus high-fidelity labels on ~5 reps per clip; rely on total counts for the rest.

**Version control:** All annotations tracked in git; metrics outputs gitignored.

---

## 5) Offline Evaluation Harness

### 5.1 Architecture
**Script:** `scripts/analyze-pose-video.ts`

**Pipeline:**
1. **Video ingestion:** Load MP4, detect native FPS (via ffprobe or canvas metadata)
2. **Frame extraction:** Decode to `ImageBitmap` frames using `OffscreenCanvas` (Node.js with `canvas` package or browser-based tool)
3. **Timestamp simulation:** Generate synthetic timestamps matching video timeline
   ```typescript
   const frameTs = startTs + (frameIndex * (1000 / videoFps));
   ```
4. **Worker pump:** Send `FRAME_IMAGE_DATA` commands with synthetic `ts` to pose worker
5. **Event collection:** Capture all emitted events:
   - `REP_COMPLETE` (with `exercise`, `confidence`, `fps`)
   - `POSE_LOST` / `POSE_REGAINED`
   - `DEBUG_METRICS` (theta, state, valid, confidence)
   - `DEBUG_ANKLE_CHECK` (reason, scores, leg length)
6. **Metrics export:** JSON output:
   ```json
   {
     "video_meta": { "id": "squat_front_01", "fps": 30, "duration_ms": 45000 },
     "config": { "thetaDownDegrees": 100, "emaAlpha": 0.3, ... },
     "events": [ { "type": "REP_COMPLETE", "ts": 1523, ... }, ... ],
     "frame_metrics": [ { "ts": 33, "theta": 165.2, "confidence": 0.89, ... }, ... ]
   }
   ```

**CLI interface:**
```bash
pnpm analyze-pose-video \
  --video packages/infra/pose-tuning/raw/squat_front_01.mp4 \
  --angle front \
  --exercise squat \
  --config-override '{"thetaDownDegrees":95}' \
  --out packages/infra/pose-tuning/processed/squat_front_01_run1.json
```

### 5.2 Critical Implementation Details

#### Frame Rate Handling
- Worker has FPS throttling via `shouldProcessFrame()` (`pose.ts:192`)
- Harness must simulate real-time or disable throttling:
  ```typescript
  // Option A: Real-time simulation (space frames by 1000/fps ms)
  await sleep(1000 / videoFps);

  // Option B: Disable throttling (send INIT with targetFps=9999)
  worker.postMessage({ type: 'INIT', targetFps: 9999 });
  ```

#### Timestamp Consistency
Worker uses `frameTs` for:
- Phase transitions (`squat.phase` state machine)
- `minDownHoldMs` timing (must hold depth for N ms)
- Debounce logic (`debounceMs` between reps)

Synthetic timestamps must reflect video timeline, not processing time.

#### State Reset Between Videos
Send `STOP` command before each new video to reset squat detection state.

---

## 6) Evaluation Metrics & Reporting

### 6.1 Accuracy Metrics Script
**Script:** `scripts/evaluate-pose-accuracy.ts`

**Inputs:**
- Annotation CSV (`packages/infra/pose-tuning/annotations/*.csv`)
- Harness output JSON (`packages/infra/pose-tuning/processed/*.json`)

**Metrics:**
- **Accuracy:** `1 - (|detected - ground_truth| / ground_truth)`
- **Precision:** False positives (double-counts) / total detected
- **Recall:** False negatives (missed reps) / ground truth
- **Orientation accuracy:** % of frames where `detectOrientation()` matches labeled angle
- **Ankle check false positives:** Valid squats rejected due to `areAnklesSymmetric()` failure

**Output:** Markdown report at `packages/infra/pose-tuning/metrics/YYYY-MM-DD-{exercise}.md`
```markdown
## Squat Tuning Run — 2025-09-30

### Summary
- Videos evaluated: 9 (3 per angle)
- Overall accuracy: 96.2%
- False positives: 2 (both in back angle, low light)
- False negatives: 3 (1 front, 2 side)

### Per-Angle Breakdown
| Angle | Accuracy | Precision | Recall | Orientation Match |
|-------|----------|-----------|--------|-------------------|
| Front | 98.5%    | 100%      | 97.1%  | 100%              |
| Side  | 95.3%    | 94.7%     | 100%   | 98.2%             |
| Back  | 94.8%    | 91.2%     | 98.5%  | 92.1%             |

### Issues
- Back angle: 2 double-counts in low light (confidence drops during descent)
- Side angle: 1 false negative (extreme forward lean misclassified as pose loss)

### Recommendations
- Increase `back.confidenceDelta` to -0.15 (from -0.20)
- Add hysteresis to orientation detection for side angle
```

---

## 7) Heuristic Tuning Process

### 7.1 Tunable Parameters (Current Implementation)

#### Per-Angle Adjustments (`VIEW_TUNING` at `pose.ts:29-60`)
```typescript
{
  front: {
    confidenceDelta: 0,      // Baseline confidence threshold
    thetaDownDelta: 0,       // Angle adjustment for "down" threshold
    thetaUpDelta: 0,         // Angle adjustment for "up" threshold
    singleSidePenaltyDelta: 0,
    ankleSymmetryMultiplier: 1.0,  // Strictness of ankle check
  },
  side: { confidenceDelta: -0.05, thetaDownDelta: -5, ... },
  back: { confidenceDelta: -0.20, thetaDownDelta: -15, ... },
}
```

#### Global Configuration (`PoseWorkerConfig`)
See `pose.types.ts` for defaults; key parameters:
- `keypointConfidenceThreshold`: Base threshold for keypoint validity (default 0.3)
- `thetaDownDegrees`: Knee angle for "down" phase (default 100°)
- `thetaUpDegrees`: Knee angle for "up" phase (default 160°)
- `minDownHoldMs`: Required hold time at depth (default 200ms)
- `emaAlpha`: Smoothing factor for theta (default 0.3)
- `singleSidePenalty`: Confidence penalty when only one leg visible (default 0.85)
- `ankleConfidenceMin`: Minimum confidence for ankle keypoints (default 0.25)
- `ankleSymmetryThreshold`: Max vertical ankle difference as % of leg length (default 0.15)
- `minLegLengthPixels`: Minimum leg length to validate ankle symmetry (default 100)

### 7.2 Tuning Workflow

**Phase 1: Baseline Analysis**
1. Run harness on 3 videos per angle with default config
2. Generate metrics report
3. Identify failure patterns (double-counts, missed reps, orientation errors)

**Phase 2: Hypothesis-Driven Adjustment**
Example iterations:
- **Issue:** Back angle has 3 false positives (double-counts at bottom of squat)
  - **Hypothesis:** Confidence drops during descent; worker interprets as pose loss → regain → new rep
  - **Action:** Increase `back.confidenceDelta` to -0.15 (less strict), increase `minDownHoldMs` to 300ms
  - **Test:** Rerun back angle videos; verify double-counts eliminated without introducing false negatives

- **Issue:** Side angle missing reps when user leans forward
  - **Hypothesis:** Orientation detector misclassifies as front/back
  - **Action:** Widen side angle tolerance in `isOrientationValid()` (already lenient per `pose.ts:648`)
  - **Test:** Validate with annotated forward-lean clips

**Phase 3: Cross-Validation**
- After per-angle tuning, run full suite (all angles × all lighting conditions)
- Ensure changes to one angle didn't regress others
- Target: ≥95% accuracy across all clips

**Phase 4: Documentation**
- Update `VIEW_TUNING` constants with justification comments
- Add tuning log entry in this document:
  ```markdown
  ### Tuning Log
  **2025-09-30:** Adjusted back angle
  - `confidenceDelta`: -0.20 → -0.15 (reduced false positives in low light)
  - `minDownHoldMs`: 200 → 250 (eliminated bounce double-counts)
  - Result: 94.8% → 97.1% accuracy
  ```

---

## 8) Automation & CI Integration

### 8.1 Automated Regression Testing
**Goal:** Prevent parameter changes from breaking existing accuracy

**Approach:**
1. Maintain "golden" test set: 2 videos per angle (6 total) in `packages/infra/pose-tuning/golden/`
2. CI hook (GitHub Actions):
   ```yaml
   - name: Pose Regression Test
     run: |
       pnpm analyze-pose-video --batch packages/infra/pose-tuning/golden/*.mp4
       pnpm evaluate-pose-accuracy --require-min 95
   ```
3. Fail build if accuracy drops below threshold

### 8.2 Historical Tracking
- Store metrics reports in `packages/infra/pose-tuning/metrics/YYYY-MM-DD-{run-id}.md` (git-tracked)
- Enables comparison across tuning iterations

---

## 9) Exercise-Specific Extensions

### 9.1 Template for New Exercises
See `exercise-template.md` for detailed template.

**Quick checklist per exercise:**
1. **Biomechanics:** Define joint angles, movement phases, keypoint requirements
2. **Angle support:** Which camera angles work? (e.g., push-ups: side only)
3. **Heuristic design:** Adapt `computeKneeMetrics()` or create new metric function
4. **Failure modes:** Occlusions, similar movements (e.g., squat vs. lunge)
5. **Baseline parameters:** Initial thresholds before tuning

### 9.2 Push-Ups (Example Roadmap)
- **Keypoints:** Shoulders, elbows, wrists, hips
- **Metric:** Elbow angle (180° → 90°) + hip-shoulder alignment
- **Angles:** Side view (primary); front/back infeasible (body obscures joints)
- **Tuning:** Create `computeElbowMetrics()` in `poseMath.ts`; add `pushup` mode to worker

---

## 10) Open Questions & Future Work

### Resolved Questions
- ✅ **Angle auto-detection:** Already implemented (`detectOrientation()`)
- ✅ **Parameter structure:** Clarified actual tunable config

### Open Questions
- **Model alternatives:** If back-angle accuracy remains <95%, evaluate BlazePose 3D (heavier but more robust to occlusion)
- **On-device vs. CDN:** Currently fetch MoveNet from CDN; consider bundling for offline-first PWA
- **Multi-exercise state machine:** When adding 3+ exercises, refactor worker to support exercise-specific state machines

### Future Enhancements
- **Adaptive thresholds:** Use LLM/ML to auto-tune parameters from annotated footage
- **Real-time feedback:** Extend debug metrics to provide form coaching ("knees caving in," "partial depth")
- **Multi-person support:** Track multiple pose subjects (requires BlazePose Multi-Pose or YOLO)

---

## 11) Next Steps

### Immediate (Week 1)
1. ✅ Revise this plan document
2. ✅ Create `exercise-template.md`
3. Implement `analyze-pose-video.ts` (MVP: frame extraction + worker pump)
4. Capture 3 bodyweight squat videos per angle (9 total)
5. Create baseline annotations

### Short-Term (Week 2)
6. Implement `evaluate-pose-accuracy.ts`
7. Run baseline analysis; generate first metrics report
8. Tune parameters for front/side angles (target ≥95%)
9. Iterate on back angle (most challenging)

### Medium-Term (Week 3-4)
10. Expand test set to 10 videos per angle
11. Add barbell squat edge cases (5 videos)
12. Set up CI regression test
13. Document final tuned parameters + rationale

### Long-Term (Post-MVP)
14. Apply process to push-ups
15. Build web-based visualization tool (`/pose-lab`)
16. Explore BlazePose 3D for back-angle improvements

---

## 12) References

- **Code:** `packages/app/src/workers/pose.ts`, `poseMath.ts`
- **Architecture:** `docs/system/12-pose-worker-spec.md`
- **Product requirements:** `docs/product/01-vision-mvp.md`
- **Exercise template:** `exercise-template.md`
- **Annotation schema:** `annotations/schema.md`
- **Scripts:** `scripts/analyze-pose-video.ts`, `scripts/evaluate-pose-accuracy.ts`

---

## Directory Structure

```
packages/infra/pose-tuning/
├── README.md                    # This file
├── exercise-template.md         # Template for documenting each exercise
├── annotations/                 # Ground truth annotations (tracked in git)
│   ├── schema.md               # Annotation format documentation
│   ├── squat-front-01.csv
│   ├── squat-side-01.csv
│   └── ...
├── raw/                        # Source videos (gitignored)
│   ├── squat_front_01.mp4
│   ├── squat_side_01.mp4
│   └── ...
├── processed/                  # Analysis outputs (gitignored)
│   ├── squat_front_01.json
│   └── ...
├── metrics/                    # Evaluation reports (tracked in git)
│   ├── 2025-09-30-squat.md
│   └── ...
└── golden/                     # Regression test set (tracked via LFS or external)
    ├── squat_front_golden.mp4
    └── ...
```

---

**Document Status:** ✅ Ready for implementation
**Owner:** Steven (solo dev)
**Next Review:** After Week 1 baseline analysis
