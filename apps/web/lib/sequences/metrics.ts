import { sequenceRuntimeSec, sequenceTrackCount } from "@selecta/library/sequence-runtime";
import { formatMixPoint } from "@selecta/library/mix-point";

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

export function mixFacts(transition: {
  technique: string | null;
  fromBar: number | null;
  toBar: number | null;
  fromCue?: string | null;
  toCue?: string | null;
  barsOverlap: number | null;
}): {
  from: string | null;
  into: string | null;
  overlap: number | null;
  technique: string | null;
} {
  return {
    from: formatMixPoint(transition.fromCue, transition.fromBar),
    into: formatMixPoint(transition.toCue, transition.toBar),
    overlap: finiteBar(transition.barsOverlap),
    technique: transition.technique?.trim() || null,
  };
}

/** Accessible one-liner: From, Into, Overlap, then type. */
export function mixLabel(transition: {
  technique: string | null;
  fromBar: number | null;
  toBar: number | null;
  fromCue?: string | null;
  toCue?: string | null;
  barsOverlap: number | null;
}): string {
  const facts = mixFacts(transition);
  const parts: string[] = [];
  if (facts.from) parts.push(`From ${facts.from}`);
  if (facts.into) parts.push(`Into ${facts.into}`);
  if (facts.overlap != null) parts.push(`Overlap ${facts.overlap}`);
  if (facts.technique) parts.push(facts.technique);
  return parts.join(" · ") || "mix";
}
