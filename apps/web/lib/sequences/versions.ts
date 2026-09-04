import { spanRange } from "./alternates";
import type { SequenceAlternate, SequenceKind, SequenceStep } from "./types";

export const BASE_VERSION_VALUE = "base";

export function canManageVersions(kind: SequenceKind): boolean {
  return kind === "block";
}

export function showVersionSwitcher(
  kind: SequenceKind,
  versionCount: number,
  mappedAlternateCount: number,
): boolean {
  return canManageVersions(kind) && (versionCount > 0 || mappedAlternateCount > 0);
}

export function formatVersionChip(label: string | null): string {
  const trimmed = label?.trim();
  return trimmed ? `alternate · ${trimmed}` : "alternate";
}

export function spansOverlap(
  a: { fromIdx: number; toIdx: number },
  b: { fromIdx: number; toIdx: number },
): boolean {
  return a.fromIdx <= b.toIdx && b.fromIdx <= a.toIdx;
}

export function idsConflictingWithSelection(
  steps: readonly SequenceStep[],
  alternates: readonly SequenceAlternate[],
  selectedIds: ReadonlySet<string>,
): Set<string> {
  const selectedRanges = alternates.flatMap((item) => {
    if (!selectedIds.has(item.id) || !item.valid) return [];
    const span = spanRange(steps, item.fromStepId, item.toStepId);
    return span ? [{ id: item.id, span }] : [];
  });
  const conflicts = new Set<string>();
  for (const item of alternates) {
    if (selectedIds.has(item.id) || !item.valid) continue;
    const span = spanRange(steps, item.fromStepId, item.toStepId);
    if (!span) continue;
    if (selectedRanges.some((selected) => spansOverlap(selected.span, span))) {
      conflicts.add(item.id);
    }
  }
  return conflicts;
}

export type ResolvedPath = {
  steps: SequenceStep[];
  chips: Record<string, string>;
};

export function resolveVersionPath(
  steps: readonly SequenceStep[],
  alternates: readonly SequenceAlternate[],
  alternateIds: readonly string[],
): ResolvedPath {
  if (alternateIds.length === 0) {
    return { steps: [...steps], chips: {} };
  }
  const chosen = alternates.filter((row) => alternateIds.includes(row.id));
  const consumed = new Set<string>();
  const resolved = steps.map((step) => ({ ...step }));
  const ranges = chosen.flatMap((alt) => {
    const span = spanRange(steps, alt.fromStepId, alt.toStepId);
    return span ? [{ alt, span }] : [];
  });
  ranges.sort((a, b) => a.span.fromIdx - b.span.fromIdx);
  const applied: typeof ranges = [];
  for (const item of ranges) {
    const ids = steps.slice(item.span.fromIdx, item.span.toIdx + 1).map((step) => step.id);
    if (ids.some((id) => consumed.has(id))) continue;
    for (const id of ids) consumed.add(id);
    applied.push(item);
  }

  const chips: Record<string, string> = {};
  for (const item of applied.reverse()) {
    const host = resolved.find((step) => step.id === item.alt.toStepId);
    if (!host) continue;
    host.inTransitionId = item.alt.altTransitionId;
    host.inBlockId = item.alt.altBlockId;
    host.inBlockVersionId = null;
    host.inTransition = item.alt.altTransition;
    host.inBlock = item.alt.altBlock;
    host.isSeam = false;
    host.gapState = item.alt.valid ? "linked" : host.gapState;
    chips[host.id] = formatVersionChip(item.alt.label);
    const fromIdx = resolved.findIndex((step) => step.id === item.alt.fromStepId);
    const toIdx = resolved.findIndex((step) => step.id === item.alt.toStepId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx) continue;
    if (fromIdx < toIdx) {
      resolved.splice(fromIdx, toIdx - fromIdx);
    }
  }
  return { steps: resolved, chips };
}

export function chosenIdsForVersion(
  versions: readonly { id: string; alternateIds: string[] }[],
  versionId: string | null,
): string[] {
  if (!versionId) return [];
  return versions.find((item) => item.id === versionId)?.alternateIds ?? [];
}
