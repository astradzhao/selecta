/**
 * Discrete proposal confidence ladder.
 * Auto-commit floor: `strong` and above.
 */
export const CONFIDENCE_LEVELS = ["none", "low", "moderate", "strong", "high", "full"] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** Inclusive auto-commit floor. */
export const AUTO_COMMIT_CONFIDENCE_FLOOR: ConfidenceLevel = "strong";

const ORDINAL: Record<ConfidenceLevel, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  strong: 3,
  high: 4,
  full: 5,
};

export function confidenceOrdinal(level: ConfidenceLevel): number {
  return ORDINAL[level];
}

/** Map enum → 0..1 for submissions.extractionConfidence storage that still expects a float. */
export function confidenceToUnitInterval(level: ConfidenceLevel): number {
  return confidenceOrdinal(level) / (CONFIDENCE_LEVELS.length - 1);
}
