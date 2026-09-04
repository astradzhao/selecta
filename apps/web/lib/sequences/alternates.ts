import { displayVocab } from "@/lib/transitions/vocab-labels";

import { blockConnectorLabel } from "./gap-display";
import { mixLabel } from "./metrics";
import type { SequenceAlternate, SequenceStep } from "./types";

export type SpanRange<T extends { id: string; trackId: string }> = {
  fromIdx: number;
  toIdx: number;
  predecessor: T;
  destination: T;
};

export type AlternateVisual = "mapped" | "incomplete" | "broken";

export function spanRange<T extends { id: string; trackId: string }>(
  steps: readonly T[],
  fromStepId: string,
  toStepId: string,
): SpanRange<T> | null {
  const fromIdx = steps.findIndex((step) => step.id === fromStepId);
  const toIdx = steps.findIndex((step) => step.id === toStepId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx || fromIdx === 0) {
    return null;
  }
  const predecessor = steps[fromIdx - 1];
  const destination = steps[toIdx];
  if (!predecessor || !destination) return null;
  return { fromIdx, toIdx, predecessor, destination };
}

export function orderSpan(
  steps: readonly { id: string }[],
  aId: string,
  bId: string,
): { fromStepId: string; toStepId: string } | null {
  const aIdx = steps.findIndex((step) => step.id === aId);
  const bIdx = steps.findIndex((step) => step.id === bId);
  if (aIdx < 0 || bIdx < 0) return null;
  let fromIdx = Math.min(aIdx, bIdx);
  const toIdx = Math.max(aIdx, bIdx);
  if (fromIdx === 0) {
    fromIdx = 1;
  }
  if (fromIdx > toIdx) return null;
  const fromStep = steps[fromIdx];
  const toStep = steps[toIdx];
  if (!fromStep || !toStep) return null;
  return { fromStepId: fromStep.id, toStepId: toStep.id };
}

export function alternatesForGap(
  items: readonly SequenceAlternate[],
  stepId: string,
): SequenceAlternate[] {
  return items.filter((item) => item.fromStepId === stepId);
}

export function alternateCoverage(items: readonly Pick<SequenceAlternate, "valid">[]): {
  total: number;
  mapped: number;
} {
  let mapped = 0;
  for (const item of items) {
    if (item.valid) mapped += 1;
  }
  return { total: items.length, mapped };
}

export function formatAlternateCoverage(coverage: {
  total: number;
  mapped: number;
}): string | null {
  if (coverage.total === 0) return null;
  return `${coverage.total} ${coverage.total === 1 ? "alternate" : "alternates"} · ${coverage.mapped} mapped`;
}

export function alternateVisual(item: SequenceAlternate): AlternateVisual {
  if (!item.valid) return "broken";
  if (item.altBlockId && item.altBlock?.isComplete === false) return "incomplete";
  return "mapped";
}

export function alternateDesc(
  item: Pick<SequenceAlternate, "altTransition" | "altBlock">,
  fromTitle: string,
  toTitle: string,
): string {
  if (item.altBlock) {
    return blockConnectorLabel(item.altBlock, fromTitle, toTitle);
  }
  const transition = item.altTransition;
  if (!transition) return "";
  return mixLabel({
    technique: displayVocab(transition.technique) ?? "mix",
    barsOverlap: transition.barsOverlap,
    quality: displayVocab(transition.quality),
  });
}

export function canExpandAlternate(item: SequenceAlternate): boolean {
  if (!item.valid) return false;
  if (item.altBlockId) return true;
  return item.fromStepId !== item.toStepId;
}

export function coveredStepIds(
  steps: readonly SequenceStep[],
  fromStepId: string,
  toStepId: string,
): Set<string> {
  const range = spanRange(steps, fromStepId, toStepId);
  if (!range) return new Set();
  return new Set(steps.slice(range.fromIdx, range.toIdx + 1).map((step) => step.id));
}

export function versionCountUsingAlternate(
  versions: readonly { alternateIds: string[] }[],
  alternateId: string,
): number {
  return versions.filter((version) => version.alternateIds.includes(alternateId)).length;
}
