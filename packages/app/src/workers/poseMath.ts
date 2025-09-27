export interface PoseKeypoint {
  readonly x: number;
  readonly y: number;
  readonly score?: number;
  readonly name?: string;
  readonly part?: string;
}

export interface KneeMetrics {
  readonly isValid: boolean;
  readonly theta?: number;
  readonly confidence: number;
  readonly dominantSide: 'left' | 'right' | null;
  readonly validSideCount: number;
}

export interface HipDeltaMetrics {
  readonly isValid: boolean;
  readonly delta?: number;
  readonly confidence: number;
  readonly validSideCount: number;
}

export interface KneeMetricsOptions {
  readonly confidenceThreshold: number;
  readonly singleSidePenalty: number;
}

const LEFT_KEYS = ['left_hip', 'left_knee', 'left_ankle'] as const;
const RIGHT_KEYS = ['right_hip', 'right_knee', 'right_ankle'] as const;

export function computeKneeMetrics(keypoints: readonly PoseKeypoint[], options: KneeMetricsOptions): KneeMetrics {
  const left = evaluateSide(keypoints, LEFT_KEYS, options.confidenceThreshold);
  const right = evaluateSide(keypoints, RIGHT_KEYS, options.confidenceThreshold);

  const candidates = [left, right].filter((side): side is SideEvaluation => side.valid);

  if (candidates.length === 0) {
    return {
      isValid: false,
      theta: undefined,
      confidence: 0,
      dominantSide: null,
      validSideCount: 0,
    };
  }

  const minThetaSide = candidates.reduce((current, candidate) => {
    if (!current) {
      return candidate;
    }
    return candidate.theta <= current.theta ? candidate : current;
  }, candidates[0]);

  const penalty = candidates.length === 1 ? options.singleSidePenalty : 1;
  const adjustedConfidence = clamp(minThetaSide.confidence * penalty, 0, 1);

  return {
    isValid: true,
    theta: minThetaSide.theta,
    confidence: adjustedConfidence,
    dominantSide: minThetaSide.side,
    validSideCount: candidates.length,
  };
}

export function computeHipDeltaMetrics(keypoints: readonly PoseKeypoint[], threshold: number): HipDeltaMetrics {
  const left = evaluateHipDelta(keypoints, LEFT_KEYS, threshold);
  const right = evaluateHipDelta(keypoints, RIGHT_KEYS, threshold);

  const candidates = [left, right].filter((side): side is HipDeltaEvaluation => side.valid);

  if (candidates.length === 0) {
    return {
      isValid: false,
      delta: undefined,
      confidence: 0,
      validSideCount: 0,
    };
  }

  const delta = candidates.reduce((sum, candidate) => sum + candidate.delta, 0) / candidates.length;
  const confidence = candidates.reduce((sum, candidate) => sum + candidate.confidence, 0) / candidates.length;

  return {
    isValid: true,
    delta,
    confidence,
    validSideCount: candidates.length,
  };
}

interface SideEvaluation {
  readonly valid: boolean;
  readonly theta: number;
  readonly confidence: number;
  readonly side: 'left' | 'right';
}

interface HipDeltaEvaluation {
  readonly valid: boolean;
  readonly delta: number;
  readonly confidence: number;
}

function evaluateSide(keypoints: readonly PoseKeypoint[], keys: readonly string[], threshold: number): SideEvaluation {
  const hip = findKeypoint(keypoints, keys[0]);
  const knee = findKeypoint(keypoints, keys[1]);
  const ankle = findKeypoint(keypoints, keys[2]);

  if (!isKeypointValid(hip, threshold) || !isKeypointValid(knee, threshold) || !isKeypointValid(ankle, threshold)) {
    return {
      valid: false,
      theta: 0,
      confidence: 0,
      side: keys === LEFT_KEYS ? 'left' : 'right',
    };
  }

  const theta = calculateKneeAngle(hip, knee, ankle);
  const confidence = Math.min(hip.score ?? 0, knee.score ?? 0, ankle.score ?? 0);

  return {
    valid: true,
    theta,
    confidence,
    side: keys === LEFT_KEYS ? 'left' : 'right',
  };
}

function evaluateHipDelta(
  keypoints: readonly PoseKeypoint[],
  keys: readonly string[],
  threshold: number,
): HipDeltaEvaluation {
  const hip = findKeypoint(keypoints, keys[0]);
  const knee = findKeypoint(keypoints, keys[1]);

  if (!isKeypointValid(hip, threshold) || !isKeypointValid(knee, threshold)) {
    return {
      valid: false,
      delta: 0,
      confidence: 0,
    };
  }

  const delta = Math.abs(hip.y - knee.y);
  const confidence = Math.min(hip.score ?? 0, knee.score ?? 0);

  return {
    valid: true,
    delta,
    confidence,
  };
}

function findKeypoint(keypoints: readonly PoseKeypoint[], name: string) {
  return keypoints.find((keypoint) => keypoint?.name === name || keypoint?.part === name);
}

function isKeypointValid(keypoint: PoseKeypoint | undefined, threshold: number): keypoint is PoseKeypoint {
  return keypoint != null && (keypoint.score ?? 0) >= threshold;
}

function calculateKneeAngle(hip: PoseKeypoint, knee: PoseKeypoint, ankle: PoseKeypoint): number {
  const vectorA = { x: hip.x - knee.x, y: hip.y - knee.y };
  const vectorB = { x: ankle.x - knee.x, y: ankle.y - knee.y };

  const dot = vectorA.x * vectorB.x + vectorA.y * vectorB.y;
  const magnitudeA = Math.hypot(vectorA.x, vectorA.y);
  const magnitudeB = Math.hypot(vectorB.x, vectorB.y);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 180;
  }

  const cosine = clamp(dot / (magnitudeA * magnitudeB), -1, 1);
  const radians = Math.acos(cosine);
  const degrees = (radians * 180) / Math.PI;

  return clamp(degrees, 0, 180);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
