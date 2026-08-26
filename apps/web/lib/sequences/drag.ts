import type { DragPayload, DropTarget, WorkspaceSelection } from "./types";

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
    };

export function insertIndex(
  selection: WorkspaceSelection,
  steps: readonly { id: string }[],
): number | "append" {
  if (selection.kind === "none") return "append";
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
  steps: readonly { trackId: string }[],
  transition: FitTransition | null = null,
): boolean {
  if (!payload) return false;
  if (payload.kind === "track") return true;
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

/** Query the Transitions palette should send (D13): the selected pair, else outbound from the anchor. */
export function paletteTransitionQuery(
  selection: WorkspaceSelection,
  steps: readonly { id: string; trackId: string }[],
): { fromTrackId?: string; toTrackId?: string } {
  if (selection.kind === "gap") {
    const gapIndex = steps.findIndex((step) => step.id === selection.stepId);
    if (gapIndex > 0) {
      const from = steps[gapIndex - 1];
      const to = steps[gapIndex];
      if (from && to) {
        return { fromTrackId: from.trackId, toTrackId: to.trackId };
      }
    }
  } else {
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
): string | null {
  const insertAt = numericInsertIndex(selection, steps);
  const target: DropTarget =
    selection.kind === "gap" ? { kind: "gap", index: insertAt } : { kind: "end", index: insertAt };
  if (dropFit(payload, target, steps, payload)) return null;
  if (selection.kind === "gap") return "Does not fit the selected gap";
  return `Starts from ${payload.fromTitle} — select a step there first`;
}
