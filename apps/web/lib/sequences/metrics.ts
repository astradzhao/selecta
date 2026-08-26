import type { SequenceGapState, SequenceStep, SequenceStepTrack } from "./types";

export function plannedMetrics(steps: Pick<SequenceStep, "gapState">[]): {
  linked: number;
  planned: number;
  seams: number;
} {
  let linked = 0;
  let planned = 0;
  let seams = 0;
  for (const step of steps) {
    if (step.gapState == null) continue;
    if (step.gapState === "seam") {
      seams += 1;
      continue;
    }
    planned += 1;
    if (step.gapState === "linked") linked += 1;
  }
  return { linked, planned, seams };
}

export function formatPlannedLine(
  metrics: { linked: number; planned: number; seams: number },
  trackCount: number,
): string {
  if (trackCount === 0) return "nothing planned yet";
  return `${metrics.linked} of ${metrics.planned} planned`;
}

export function sequenceRuntimeSec(
  steps: Array<{
    gapState: SequenceGapState | null;
    track: SequenceStepTrack | null;
    inTransition: { barsOverlap: number | null } | null;
  }>,
): number {
  let total = 0;
  for (const step of steps) {
    const duration = step.track?.durationSec;
    if (duration != null && Number.isFinite(duration)) total += duration;
  }
  for (let i = 1; i < steps.length; i++) {
    const dest = steps[i]!;
    const prev = steps[i - 1]!;
    if (dest.gapState !== "linked") continue;
    const overlap = dest.inTransition?.barsOverlap;
    const bpm = prev.track?.bpm;
    if (
      overlap == null ||
      bpm == null ||
      !Number.isFinite(overlap) ||
      !Number.isFinite(bpm) ||
      bpm <= 0
    ) {
      continue;
    }
    total -= (overlap * 4 * 60) / bpm;
  }
  return Math.max(0, total);
}

export function formatApproxRuntime(totalSec: number): string {
  return `approx ${Math.round(totalSec / 60)} min`;
}

export function bpmDelta(
  fromBpm: number | null | undefined,
  toBpm: number | null | undefined,
): string | null {
  if (fromBpm == null || toBpm == null || !Number.isFinite(fromBpm) || !Number.isFinite(toBpm)) {
    return null;
  }
  const delta = toBpm - fromBpm;
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `−${Math.abs(delta)}`;
  return "0";
}

export function mixLabel(transition: {
  technique: string;
  barsOverlap: number | null;
  quality: string | null;
}): string {
  const parts = [transition.technique];
  if (transition.barsOverlap != null && Number.isFinite(transition.barsOverlap)) {
    parts.push(`${transition.barsOverlap} bar${transition.barsOverlap === 1 ? "" : "s"}`);
  }
  if (transition.quality) parts.push(transition.quality);
  return parts.join(" · ");
}
