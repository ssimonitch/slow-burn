# Exercise Tuning Template — [Exercise Name]

**Exercise:** [e.g., Squat, Push-up, Lunge]
**Created:** [Date]
**Status:** [Planning / In Progress / Tuned / Production]
**Owner:** [Your name]

---

## 1) Biomechanics Overview

### Movement Description
[2-3 sentences describing the exercise and key phases]

**Example (Squat):**
> A compound lower-body movement where the user descends by bending knees and hips, then returns to standing. Key phases: standing (up), descending, bottom hold, ascending. Full range requires ~90° knee flexion.

### Critical Joint Angles
**Primary metric:** [Which joint angle defines the movement?]
- **Starting position:** [e.g., 170° knee angle]
- **Bottom/depth position:** [e.g., 90° knee angle]
- **Transition thresholds:** [Angles that trigger phase changes]

**Example (Squat):**
- **Primary:** Knee angle (hip-knee-ankle)
- **Standing (UP):** ≥160°
- **Depth (DOWN):** ≤100°
- **Hysteresis:** 60° range prevents bouncing double-counts

### Secondary Validations
[Additional checks to prevent false positives]

**Example (Squat):**
- **Ankle symmetry:** Both feet planted; vertical ankle difference < 15% of leg length
- **Orientation detection:** Facial keypoints determine front/side/back view
- **Confidence gating:** All keypoints (hip, knee, ankle) must meet threshold

---

## 2) Required Keypoints

### MoveNet 2D Keypoints
List the keypoints required for detection:

**Example (Squat):**
- **Left side:** `left_hip`, `left_knee`, `left_ankle`
- **Right side:** `right_hip`, `right_knee`, `right_ankle`
- **Orientation (optional):** `nose`, `left_eye`, `right_eye`
- **Validation:** `left_ankle`, `right_ankle` (symmetry check)

### Visibility by Camera Angle
| Keypoint | Front | Side | Back | Notes |
|----------|-------|------|------|-------|
| `left_hip` | ✅ High | ✅ High | ⚠️ Medium | Back view: torso may occlude |
| `left_knee` | ✅ High | ✅ High | ✅ High | Consistently visible |
| `left_ankle` | ✅ High | ⚠️ Medium | ⚠️ Medium | Side/back: perspective issues |
| `nose` | ✅ High | ⚠️ Low | ❌ None | Used for orientation detection |

**Legend:**
- ✅ High: >80% confidence expected
- ⚠️ Medium: 40-80% confidence
- ❌ None/Low: <40% confidence

---

## 3) Camera Angle Support

### Recommended Angles
**Primary angle(s):** [Which angle(s) work best?]

**Example (Squat):**
- **Primary:** Front, side
- **Secondary:** Back (lower confidence, requires adjusted thresholds)

**Example (Push-up):**
- **Primary:** Side only
- **Why:** Front/back views obscure elbows and wrists

### Angle-Specific Challenges
| Angle | Challenges | Mitigation Strategy |
|-------|-----------|---------------------|
| Front | [e.g., Depth perception harder] | [e.g., Use knee angle instead of hip depth] |
| Side | [e.g., One leg occludes the other] | [e.g., Accept single-leg detection with penalty] |
| Back | [e.g., No facial keypoints for orientation] | [e.g., Skip orientation check, rely on user selection] |

---

## 4) Heuristic Design

### Metric Function
**Location:** `packages/app/src/workers/poseMath.ts`

**Function signature:**
```typescript
export function compute[Exercise]Metrics(
  keypoints: readonly PoseKeypoint[],
  options: [Exercise]MetricsOptions
): [Exercise]Metrics {
  // Implementation
}
```

**Example (Squat):**
```typescript
export function computeKneeMetrics(
  keypoints: readonly PoseKeypoint[],
  options: KneeMetricsOptions
): KneeMetrics {
  // Evaluate both legs
  // Return min theta (deepest squat), confidence, dominant side
}
```

### Phase State Machine
**Location:** `packages/app/src/workers/pose.ts` (or exercise-specific worker)

**States:**
- `NO_POSE`: No valid pose detected
- `[EXERCISE_PHASE_1]`: [e.g., UP for squat]
- `[EXERCISE_PHASE_2]`: [e.g., DOWN for squat]

**Transitions:**
```
NO_POSE → PHASE_1: [Condition, e.g., theta ≥ 160°]
PHASE_1 → PHASE_2: [Condition, e.g., theta ≤ 100° held for 200ms]
PHASE_2 → PHASE_1: [Condition, e.g., theta ≥ 160° + debounce]
PHASE_1 → NO_POSE: [Condition, e.g., pose lost for >1000ms]
```

**Rep completion event:** Triggered on `PHASE_2 → PHASE_1` transition

---

## 5) Baseline Parameters

### Global Config (Default Values)
```typescript
{
  keypointConfidenceThreshold: 0.3,  // Min score for keypoint validity
  [exercise]DownThreshold: [value],  // Bottom position
  [exercise]UpThreshold: [value],    // Top position
  minHoldMs: 200,                     // Hold time at bottom to confirm phase
  debounceMs: 300,                    // Cooldown between reps
  emaAlpha: 0.3,                      // Smoothing factor for metric
  singleSidePenalty: 0.85,            // Confidence penalty if only one side visible
}
```

**Example (Squat):**
```typescript
{
  keypointConfidenceThreshold: 0.3,
  thetaDownDegrees: 100,
  thetaUpDegrees: 160,
  minDownHoldMs: 200,
  debounceMs: 300,
  emaAlpha: 0.3,
  singleSidePenalty: 0.85,
}
```

### Per-Angle Tuning (Initial Estimates)
```typescript
VIEW_TUNING = {
  front: {
    confidenceDelta: 0,
    [metric]DownDelta: 0,
    [metric]UpDelta: 0,
    singleSidePenaltyDelta: 0,
  },
  side: {
    confidenceDelta: [estimate],
    [metric]DownDelta: [estimate],
    // ...
  },
  back: {
    confidenceDelta: [estimate],
    // ...
  },
}
```

**Rationale:** [Explain why these initial values were chosen]

**Example (Squat):**
> - **Front:** Baseline (0 deltas); best keypoint visibility
> - **Side:** `-5° thetaDown` to account for perspective foreshortening
> - **Back:** `-15° thetaDown` due to torso occlusion lowering confidence

---

## 6) Known Failure Modes

### False Positives (Double-Counts)
**Scenario:** [When does the system incorrectly count extra reps?]

**Example (Squat):**
1. **Bounce at bottom:** User bounces slightly at depth
   - **Detection:** Theta crosses threshold twice
   - **Mitigation:** `minDownHoldMs` requires sustained depth

2. **Confidence drop mid-rep:** Keypoint occlusion triggers POSE_LOST → POSE_REGAINED
   - **Detection:** System thinks user restarted
   - **Mitigation:** Increase `poseLostTimeoutMs`, lower `confidenceDelta` for problematic angles

### False Negatives (Missed Reps)
**Scenario:** [When does the system fail to count valid reps?]

**Example (Squat):**
1. **Partial depth:** User doesn't reach `thetaDownDegrees` threshold
   - **Detection:** Phase never transitions to DOWN
   - **Mitigation:** User education or adjustable depth setting (future)

2. **Fast reps:** User completes rep during debounce window
   - **Detection:** Transition rejected by `debounceMs`
   - **Mitigation:** Lower debounce (may increase false positives)

### Invalid Movement Rejection
**Scenario:** [When should the system intentionally reject movement?]

**Example (Squat):**
1. **Leg raise:** One foot lifted
   - **Detection:** Ankle symmetry check fails
   - **Prevention:** `areAnklesSymmetric()` validation

2. **Wrong orientation:** User facing wrong direction for selected angle
   - **Detection:** `detectOrientation()` mismatch
   - **Prevention:** Pose marked invalid, POSE_LOST emitted

---

## 7) Test Data Requirements

### Minimum Video Coverage
**Target:** [Number] videos per angle

**Variability matrix:**
- **Lighting:** Bright, medium, low
- **Clothing:** Fitted, loose
- **Camera position:** Floor, chest, overhead
- **Form variations:** Perfect form, [common mistake 1], [common mistake 2]
- **Rep speed:** Slow (2s/rep), moderate (1s/rep), fast (0.5s/rep)

**Example (Squat):**
- **Minimum:** 10 videos per angle (30 total)
- **Edge cases:** 5 barbell squat videos (form variation)
- **Total:** ~35 videos × 15-25 reps = 500-875 labeled reps

### Annotation Strategy
**Phase 1 (Lightweight):** Video-level annotations
```csv
video_id,exercise,angle,lighting,equipment,ground_truth_reps,notes
[exercise]_front_01,[exercise],front,bright,bodyweight,20,"clean form"
```

**Phase 2 (High-Fidelity):** Per-rep timestamps
```csv
video_id,frame_ts_ms,phase,rep_index,notes
[exercise]_front_01,1200,down,1,"full depth"
[exercise]_front_01,1800,up,1,"complete"
```

---

## 8) Evaluation Metrics

### Target Accuracy
- **Overall:** ≥95% accuracy (|detected - ground_truth| / ground_truth < 5%)
- **Precision:** ≥95% (false positives < 5%)
- **Recall:** ≥95% (false negatives < 5%)
- **Orientation detection:** ≥90% match with labeled angle (if applicable)

### Per-Angle Breakdown
| Angle | Target Accuracy | Notes |
|-------|----------------|-------|
| [Angle 1] | ≥95% | [Primary angle, highest visibility] |
| [Angle 2] | ≥90% | [Secondary angle, acceptable degradation] |
| [Angle 3] | ≥85% | [Challenging angle, may require model upgrade] |

---

## 9) Tuning Log

### Baseline Run (Date)
**Config:** [Default parameters]

**Results:**
- Overall accuracy: [X]%
- False positives: [N] across [videos]
- False negatives: [N] across [videos]

**Issues identified:**
1. [Issue description]
2. [Issue description]

### Iteration 1 (Date)
**Changes:**
- `[parameter]`: [old value] → [new value]
- **Rationale:** [Why this change was made]

**Results:**
- Overall accuracy: [X]% (Δ [+/-]%)
- [Specific metric improvements]

**Status:** [Continue tuning / Ready for validation]

### Final Tuned Parameters (Date)
**Config:**
```typescript
{
  // Final values after tuning
}
```

**Performance:**
| Angle | Accuracy | Precision | Recall |
|-------|----------|-----------|--------|
| [Angle] | [X]% | [X]% | [X]% |

**Validation:** ✅ Passes ≥95% target / ⚠️ Needs improvement / ❌ Failed

---

## 10) Implementation Checklist

- [ ] Define biomechanics and joint angles
- [ ] Identify required keypoints and visibility per angle
- [ ] Implement metric function in `poseMath.ts`
- [ ] Integrate phase state machine in `pose.ts` (or dedicated worker)
- [ ] Add exercise-specific config to `pose.types.ts`
- [ ] Capture baseline test videos (min 3 per angle)
- [ ] Create annotations (CSV)
- [ ] Run offline evaluation harness
- [ ] Baseline accuracy report
- [ ] Iterative tuning (adjust parameters)
- [ ] Validation on held-out test set
- [ ] Document final parameters + rationale
- [ ] Add to CI regression test suite
- [ ] Update product UI to expose new exercise

---

## 11) References

- **Parent plan:** `README.md`
- **Code:** `packages/app/src/workers/pose.ts`, `poseMath.ts`
- **Evaluation tools:** `scripts/analyze-pose-video.ts`, `scripts/evaluate-pose-accuracy.ts`
- **Annotations:** `annotations/[exercise]-*.csv`
- **Metrics reports:** `metrics/YYYY-MM-DD-[exercise].md`

---

## 12) Notes & Open Questions

[Add any exercise-specific considerations, research notes, or unresolved questions here]

**Example:**
- Q: Should we support kneeling push-ups as a variation?
- Q: Can we reliably detect "butt wink" (posterior pelvic tilt) in squats?
- Research: Investigate MoveNet 3D for depth perception improvements

---

**Template Version:** 1.0
**Last Updated:** 2025-09-30
