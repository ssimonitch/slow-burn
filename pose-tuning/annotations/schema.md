# Pose Data Annotation Schema

**Version:** 1.0
**Updated:** 2025-09-30
**Purpose:** Define the structure and conventions for annotating video footage used to tune and validate pose detection heuristics.

---

## Overview

Annotations provide ground truth data for evaluating pose detection accuracy. We use two annotation levels:

1. **Lightweight (Phase 1):** Video-level metadata and total rep counts
2. **High-Fidelity (Phase 2):** Per-frame or per-rep event timestamps

All annotations are stored in CSV format for easy editing and version control.

---

## File Naming Convention

```
{exercise}-{angle}-{id}.csv
```

**Examples:**
- `squat-front-01.csv`
- `squat-back-bright-05.csv`
- `pushup-side-lowlight-03.csv`

**Guidelines:**
- Use lowercase, hyphen-separated names
- `{exercise}`: Exercise name (squat, pushup, lunge, etc.)
- `{angle}`: Camera angle (front, side, back)
- `{id}`: Sequential number or descriptive tag

---

## Phase 1: Lightweight Annotations

### Purpose
Provide video-level metadata and ground truth rep counts for accuracy calculations.

### Format
**File:** One CSV per video
**Location:** `packages/infra/pose-tuning/annotations/{exercise}-{angle}-{id}.csv`

### Schema

#### Required Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `video_id` | string | Unique identifier matching video filename (without extension) | `squat_front_01` |
| `exercise` | string | Exercise type | `squat`, `pushup`, `lunge` |
| `angle` | string | Camera angle | `front`, `side`, `back` |
| `lighting` | string | Lighting condition | `bright`, `medium`, `low`, `evening` |
| `equipment` | string | Equipment used | `bodyweight`, `barbell`, `dumbbell` |
| `ground_truth_reps` | integer | Manually counted total reps | `18` |
| `notes` | string | Free-form observations | `"clean form, full depth"` |

#### Optional Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `camera_height` | string | Camera position | `floor`, `chest`, `overhead` |
| `clothing` | string | Clothing type | `fitted`, `loose` |
| `rep_speed` | string | Approximate rep cadence | `slow`, `moderate`, `fast` |
| `failure_frames` | string | Frame numbers where detection is expected to fail | `"1250-1300,2100-2150"` |
| `occlusion_timestamps` | string | Time ranges (ms) with keypoint occlusions | `"1250-1800,3200-3500"` |
| `form_notes` | string | Form deviations or variations | `"slight forward lean at rep 12"` |

### Example CSV

```csv
video_id,exercise,angle,lighting,equipment,ground_truth_reps,notes,camera_height,rep_speed
squat_front_01,squat,front,bright,bodyweight,18,"clean form, full depth",chest,moderate
squat_side_02,squat,side,medium,bodyweight,15,"some forward lean",chest,slow
squat_back_03,squat,back,evening,bodyweight,20,"low light, slight occlusion",chest,moderate
squat_front_04,squat,front,bright,barbell,22,"EDGE CASE: bar occludes shoulders",chest,moderate
pushup_side_01,pushup,side,bright,bodyweight,25,"full ROM, good elbow angle",floor,fast
```

### Usage
1. Watch video and manually count reps
2. Note lighting, equipment, and any abnormalities
3. Create one row per video
4. Save as `{exercise}-{angle}-{id}.csv`
5. Commit to git

---

## Phase 2: High-Fidelity Annotations

### Purpose
Provide per-rep or per-frame timing data for detailed debugging and validation.

### When to Use
- Investigating false positives/negatives
- Validating phase transition timing
- Testing `minDownHoldMs` and debounce logic
- Cross-referencing debug metrics with actual form

### Format
**File:** One CSV per video (can be same file as Phase 1, but separate section)
**Location:** `packages/infra/pose-tuning/annotations/{exercise}-{angle}-{id}-events.csv`

### Schema

#### Required Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `video_id` | string | Matches Phase 1 annotation | `squat_front_01` |
| `frame_ts_ms` | integer | Timestamp in milliseconds from video start | `1250` |
| `phase` | string | Movement phase at this timestamp | `down`, `up`, `hold` |
| `rep_index` | integer | Rep number (1-indexed) | `1`, `2`, `3` |

#### Optional Fields
| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `notes` | string | Observation at this frame | `"good depth"`, `"bounce at bottom"` |
| `expected_theta` | float | Approximate knee angle (if measurable) | `95.2` |
| `keypoint_visibility` | string | Comma-separated list of visible keypoints | `"left_knee,right_knee,left_hip"` |

### Example CSV

```csv
video_id,frame_ts_ms,phase,rep_index,notes
squat_front_01,0,up,0,"starting position"
squat_front_01,1250,down,1,"good depth"
squat_front_01,1850,up,1,"complete, returning to standing"
squat_front_01,2100,down,2,"slight bounce at bottom"
squat_front_01,2700,up,2,"complete"
squat_front_01,3200,down,3,"full depth"
squat_front_01,3850,up,3,"complete"
```

### Labeling Strategy
- **Sparse labeling:** Focus on 5-10 reps per video (beginning, middle, end)
- **Boundary events:** Annotate phase transitions (down→up, up→down)
- **Anomalies:** Mark any form breakdowns, occlusions, or edge cases

---

## Annotation Workflow

### Step 1: Prepare Video
1. Place video in `packages/infra/pose-tuning/raw/{exercise}-{angle}-{id}.mp4`
2. Ensure video filename matches annotation `video_id`

### Step 2: Create Phase 1 Annotation
1. Watch video at normal speed
2. Manually count total reps
3. Note lighting, equipment, and any observations
4. Fill out CSV row

### Step 3: (Optional) Create Phase 2 Annotation
1. Use video player with frame-by-frame scrubbing
2. Record timestamps for key events:
   - Rep start (beginning of descent)
   - Bottom position (deepest point)
   - Rep complete (return to standing)
3. Add notes for anomalies

### Step 4: Validation
1. Run offline evaluation harness:
   ```bash
   pnpm analyze-pose-video \
     --video packages/infra/pose-tuning/raw/{video_id}.mp4 \
     --angle {angle} \
     --exercise {exercise} \
     --out packages/infra/pose-tuning/processed/{video_id}.json
   ```
2. Compare detected rep count with `ground_truth_reps`
3. If mismatch, investigate using Phase 2 timestamps

---

## Quality Guidelines

### Annotation Accuracy
- **Rep counting:** Recount at least twice to avoid human error
- **Phase boundaries:** If unsure of exact frame, annotate to nearest 100ms
- **Form judgment:** Use exercise-specific criteria (e.g., squat depth = thigh parallel to ground)

### Edge Case Documentation
Always annotate videos that include:
- Occlusions (limbs behind torso, poor camera angle)
- Lighting extremes (very bright or very dark)
- Form variations (partial reps, asymmetric movement)
- Equipment variations (barbell, weighted vest)

Label these clearly in `notes` field and tag as `EDGE CASE:` prefix.

### Consistency
- Use standardized terms:
  - Lighting: `bright`, `medium`, `low`, `evening`
  - Equipment: `bodyweight`, `barbell`, `dumbbell`, `kettlebell`
  - Camera height: `floor`, `chest`, `overhead`
  - Rep speed: `slow`, `moderate`, `fast`

---

## Example: Complete Annotation for One Video

**Video:** `squat_front_01.mp4` (30 FPS, 45 seconds, 18 reps)

**Phase 1 CSV (`squat-front-01.csv`):**
```csv
video_id,exercise,angle,lighting,equipment,ground_truth_reps,notes,camera_height,rep_speed
squat_front_01,squat,front,bright,bodyweight,18,"clean form, full depth, consistent pace",chest,moderate
```

**Phase 2 CSV (`squat-front-01-events.csv`):**
```csv
video_id,frame_ts_ms,phase,rep_index,notes
squat_front_01,0,up,0,"starting position"
squat_front_01,1250,down,1,"good depth"
squat_front_01,1850,up,1,"complete"
squat_front_01,2100,down,2,"slight bounce at bottom"
squat_front_01,2700,up,2,"complete"
squat_front_01,3200,down,3,"full depth"
squat_front_01,3850,up,3,"complete"
```

**Evaluation Output (`squat_front_01.json`):**
```json
{
  "video_meta": {
    "id": "squat_front_01",
    "fps": 30,
    "duration_ms": 45000
  },
  "config": { "thetaDownDegrees": 100, "thetaUpDegrees": 160 },
  "events": [
    { "type": "REP_COMPLETE", "ts": 1823, "exercise": "squat", "confidence": 0.92 },
    { "type": "REP_COMPLETE", "ts": 2698, "exercise": "squat", "confidence": 0.89 },
    ...
  ],
  "summary": {
    "total_reps_detected": 18,
    "ground_truth_reps": 18,
    "accuracy": 1.0,
    "false_positives": 0,
    "false_negatives": 0
  }
}
```

**Validation:**
- Detected reps (18) matches ground truth (18) ✅
- Rep timestamps align with Phase 2 annotations within ±100ms ✅
- No false positives or negatives ✅

---

## Schema Versioning

**Current version:** 1.0

### Changelog
- **1.0 (2025-09-30):** Initial schema
  - Phase 1: Video-level metadata
  - Phase 2: Per-rep event timestamps
  - Required and optional fields defined

### Future Extensions
- **1.1:** Add `form_score` field (0-10) for subjective quality rating
- **1.2:** Support multi-person annotations (add `person_id` field)
- **2.0:** Integrate with automated annotation tools (ML-assisted labeling)

---

## Tools & Utilities

### CSV Validation Script (Future)
```bash
pnpm validate-annotations --file packages/infra/pose-tuning/annotations/squat-front-01.csv
```
Checks:
- Required fields present
- Valid enum values (angle, lighting, etc.)
- `video_id` matches existing video file
- No duplicate entries

### Annotation Statistics (Future)
```bash
pnpm annotation-stats --exercise squat
```
Output:
- Total videos annotated: 27
- Total reps annotated: 486
- Coverage: front (10 videos), side (9 videos), back (8 videos)
- Lighting: bright (15), medium (8), low (4)

---

## References

- **Parent plan:** `../README.md`
- **Exercise template:** `../exercise-template.md`
- **Evaluation harness:** `scripts/analyze-pose-video.ts`
- **Metrics calculator:** `scripts/evaluate-pose-accuracy.ts`

---

**Schema Status:** ✅ Approved for use
**Maintained by:** Solo dev (Steven)
**Next Review:** After 50 videos annotated
