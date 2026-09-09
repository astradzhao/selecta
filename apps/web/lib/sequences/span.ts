import { isLiveBlockHost, unitRange } from "./reorder";
import type { SequenceKind } from "./types";

export const WRAP_SPAN_DISABLED_REASON =
  "Make a block from the selected tracks, or clear the selection";

/** Carving a nested block is a set-workspace job. Blocks keep shift-click for alternates. */
export function canWrapSpan(kind: SequenceKind): boolean {
  return kind === "set";
}

export type StepSpan = {
  fromIdx: number;
  toIdx: number;
};

export function stepSpan(
  steps: readonly { id: string }[],
  fromStepId: string,
  toStepId: string,
): StepSpan | null {
  const fromIdx = steps.findIndex((step) => step.id === fromStepId);
  const toIdx = steps.findIndex((step) => step.id === toStepId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx) return null;
  return { fromIdx, toIdx };
}

export function orderStepSpan(
  steps: readonly { id: string }[],
  aId: string,
  bId: string,
): { fromStepId: string; toStepId: string } | null {
  const aIdx = steps.findIndex((step) => step.id === aId);
  const bIdx = steps.findIndex((step) => step.id === bId);
  if (aIdx < 0 || bIdx < 0) return null;
  const fromIdx = Math.min(aIdx, bIdx);
  const toIdx = Math.max(aIdx, bIdx);
  const fromStep = steps[fromIdx];
  const toStep = steps[toIdx];
  if (!fromStep || !toStep) return null;
  return { fromStepId: fromStep.id, toStepId: toStep.id };
}

export function snapSpanToUnits(
  steps: readonly unknown[],
  fromIdx: number,
  toIdx: number,
): StepSpan {
  const [start] = unitRange(steps, fromIdx);
  const [, end] = unitRange(steps, toIdx);
  return { fromIdx: start, toIdx: end };
}

export function isExactLiveUnit(
  steps: readonly unknown[],
  fromIdx: number,
  toIdx: number,
): boolean {
  if (fromIdx < 0 || toIdx >= steps.length || fromIdx > toIdx) return false;
  const [start, end] = unitRange(steps, fromIdx);
  return start === fromIdx && end === toIdx && isLiveBlockHost(steps[toIdx]);
}

export function coveredStepIdsInRange(
  steps: readonly { id: string }[],
  fromStepId: string,
  toStepId: string,
): Set<string> {
  const range = stepSpan(steps, fromStepId, toStepId);
  if (!range) return new Set();
  return new Set(steps.slice(range.fromIdx, range.toIdx + 1).map((step) => step.id));
}
