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

function finiteBar(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

/** Running-order one-liner: in/out bars and overlap, then technique if we have one. */
export function mixLabel(transition: {
  technique: string | null;
  fromBar: number | null;
  toBar: number | null;
  barsOverlap: number | null;
}): string {
  const parts: string[] = [];
  const fromBar = finiteBar(transition.fromBar);
  const overlap = finiteBar(transition.barsOverlap);
  const toBar = finiteBar(transition.toBar);
  if (fromBar != null) parts.push(`out ${fromBar}`);
  if (overlap != null) parts.push(`overlap ${overlap}`);
  if (toBar != null) parts.push(`in ${toBar}`);
  if (transition.technique) parts.push(transition.technique);
  return parts.join(" · ") || "mix";
}
