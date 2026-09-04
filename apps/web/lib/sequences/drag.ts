import { spanRange } from "./alternates";
import { isLiveBlockHost } from "./reorder";
import type { DragPayload, DropTarget, SequenceRecord, WorkspaceSelection } from "./types";

export type FitTransition = {
  fromTrackId: string;
  toTrackId: string;
};

export type FitPayload =
  | { kind: "track"; id: string; title: string }
  | {
      kind: "transition";
      id: string;
      fromTrackId: string;
      toTrackId: string;
      fromTitle: string;
      toTitle: string;
      technique: string;
    }
  | {
      kind: "block";
      id: string;
      title: string;
      stepCount: number;
      startTrackId: string | null;
      endTrackId: string | null;
      isComplete: boolean;
    };

export type FitStep = {
  trackId: string;
  inBlockId?: string | null;
  gapState?: string | null;
};

export function blockFitPayload(row: SequenceRecord): Extract<FitPayload, { kind: "block" }> {
  return {
    kind: "block",
    id: row.id,
    title: row.title,
    stepCount: row.stepCount,
    startTrackId: row.startTrackId,
    endTrackId: row.endTrackId,
    isComplete: row.isComplete,
  };
}

export type SpanFit = {
  fromIdx: number;
  fromTrackId: string;
  toTrackId: string;
};

export function insertIndex(
  selection: WorkspaceSelection,
  steps: readonly { id: string }[],
): number | "append" {
  if (selection.kind === "none" || selection.kind === "span") return "append";
  const at = steps.findIndex((step) => step.id === selection.stepId);
  if (at < 0) return "append";
  return selection.kind === "gap" ? at : at + 1;
}

export function numericInsertIndex(
  selection: WorkspaceSelection,
  steps: readonly { id: string }[],
): number {
  const index = insertIndex(selection, steps);
  return index === "append" ? steps.length : index;
}

export function dropFit(
  payload: DragPayload | FitPayload | null,
  target: DropTarget,
  steps: readonly FitStep[],
  transition: FitTransition | null = null,
  span: SpanFit | null = null,
): boolean {
  if (!payload) return false;
  if (span) {
    if (payload.kind === "track") return false;
    if (target.kind !== "gap" || target.index !== span.fromIdx) return false;
    if (payload.kind === "block") {
      return Boolean(
        payload.isComplete &&
        payload.startTrackId === span.fromTrackId &&
        payload.endTrackId === span.toTrackId,
      );
    }
    const edge =
      transition ??
      (payload.kind === "transition" && "fromTrackId" in payload
        ? { fromTrackId: payload.fromTrackId, toTrackId: payload.toTrackId }
        : null);
    return Boolean(
      edge && edge.fromTrackId === span.fromTrackId && edge.toTrackId === span.toTrackId,
    );
  }
  if (payload.kind === "track") {
    if (target.kind === "gap") {
      const dest = steps[target.index];
      if (dest && isLiveBlockHost(dest)) return false;
    }
    return true;
  }
  if (payload.kind === "block") {
    if (!payload.isComplete || !payload.startTrackId || !payload.endTrackId) return false;
    if (target.kind === "gap") {
      const prev = steps[target.index - 1];
      const dest = steps[target.index];
      return Boolean(
        prev &&
        dest &&
        payload.startTrackId === prev.trackId &&
        payload.endTrackId === dest.trackId,
      );
    }
    return true;
  }
  const edge =
    transition ??
    (payload.kind === "transition" && "fromTrackId" in payload
      ? { fromTrackId: payload.fromTrackId, toTrackId: payload.toTrackId }
      : null);
  if (!edge) return false;
  if (target.kind === "gap") {
    const prev = steps[target.index - 1];
    const dest = steps[target.index];
    return Boolean(
      prev && dest && edge.fromTrackId === prev.trackId && edge.toTrackId === dest.trackId,
    );
  }
  const prev = steps[target.index - 1];
  return !prev || edge.fromTrackId === prev.trackId;
}

export function autoLinkTransitionId(candidates: readonly { id: string }[]): string | null {
  return candidates.length === 1 ? candidates[0]!.id : null;
}

export function nestedSelectedStep<T extends { id: string }>(
  selection: WorkspaceSelection,
  steps: readonly T[],
  nestedSteps: readonly T[],
): T | null {
  if (selection.kind !== "step") return null;
  if (steps.some((step) => step.id === selection.stepId)) return null;
  return nestedSteps.find((step) => step.id === selection.stepId) ?? null;
}

/** Query the Transitions palette should send: selected pair, span pair, else outbound from the anchor. */
export function paletteTransitionQuery(
  selection: WorkspaceSelection,
  steps: readonly { id: string; trackId: string }[],
  nestedSteps: readonly { id: string; trackId: string }[] = [],
): { fromTrackId?: string; toTrackId?: string } {
  const nested = nestedSelectedStep(selection, steps, nestedSteps);
  if (nested) return { fromTrackId: nested.trackId };
  if (selection.kind === "span") {
    const range = spanRange(steps, selection.fromStepId, selection.toStepId);
    if (range) {
      return { fromTrackId: range.predecessor.trackId, toTrackId: range.destination.trackId };
    }
  }
  if (selection.kind === "gap") {
    const gapIndex = steps.findIndex((step) => step.id === selection.stepId);
    if (gapIndex > 0) {
      const from = steps[gapIndex - 1];
      const to = steps[gapIndex];
      if (from && to) {
        return { fromTrackId: from.trackId, toTrackId: to.trackId };
      }
    }
  } else if (selection.kind !== "span") {
    const insertAt = numericInsertIndex(selection, steps);
    const anchor = insertAt > 0 ? steps[insertAt - 1] : null;
    if (anchor) return { fromTrackId: anchor.trackId };
  }
  const last = steps[steps.length - 1];
  return last ? { fromTrackId: last.trackId } : {};
}

export function paletteTransitionReason(
  payload: Extract<FitPayload, { kind: "transition" }>,
  selection: WorkspaceSelection,
  steps: readonly { id: string; trackId: string }[],
  nestedSteps: readonly { id: string; trackId: string }[] = [],
): string | null {
  if (selection.kind === "span") {
    const range = spanRange(steps, selection.fromStepId, selection.toStepId);
    if (
      range &&
      payload.fromTrackId === range.predecessor.trackId &&
      payload.toTrackId === range.destination.trackId
    ) {
      return null;
    }
    return "Does not fit the selected span";
  }
  const nested = nestedSelectedStep(selection, steps, nestedSteps);
  if (nested) {
    return payload.fromTrackId === nested.trackId
      ? null
      : `Starts from ${payload.fromTitle} — select a step there first`;
  }
  const insertAt = numericInsertIndex(selection, steps);
  const target: DropTarget =
    selection.kind === "gap" ? { kind: "gap", index: insertAt } : { kind: "end", index: insertAt };
  if (dropFit(payload, target, steps, payload)) return null;
  if (selection.kind === "gap") return "Does not fit the selected gap";
  return `Starts from ${payload.fromTitle} — select a step there first`;
}

export function paletteBlockReason(
  payload: Extract<FitPayload, { kind: "block" }>,
  selection: WorkspaceSelection,
  steps: readonly { id: string; trackId: string }[],
): string | null {
  if (!payload.isComplete || !payload.startTrackId || !payload.endTrackId) {
    return "Incomplete blocks cannot be used as connectors";
  }
  if (selection.kind === "span") {
    const range = spanRange(steps, selection.fromStepId, selection.toStepId);
    if (
      range &&
      payload.startTrackId === range.predecessor.trackId &&
      payload.endTrackId === range.destination.trackId
    ) {
      return null;
    }
    return "Does not fit the selected span";
  }
  const insertAt = numericInsertIndex(selection, steps);
  const target: DropTarget =
    selection.kind === "gap" ? { kind: "gap", index: insertAt } : { kind: "end", index: insertAt };
  if (dropFit(payload, target, steps)) return null;
  if (selection.kind === "gap") return "Does not fit the selected gap";
  return null;
}

export function spanFitFromSelection(
  selection: WorkspaceSelection,
  steps: readonly { id: string; trackId: string }[],
): SpanFit | null {
  if (selection.kind !== "span") return null;
  const range = spanRange(steps, selection.fromStepId, selection.toStepId);
  if (!range) return null;
  return {
    fromIdx: range.fromIdx,
    fromTrackId: range.predecessor.trackId,
    toTrackId: range.destination.trackId,
  };
}
