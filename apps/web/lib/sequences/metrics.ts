import { sequenceRuntimeSec, sequenceTrackCount } from "@selecta/library/sequence-runtime";

import type { SequenceStep } from "./types";

export { sequenceRuntimeSec, sequenceTrackCount };

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
