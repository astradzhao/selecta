import { displayVocab } from "@/lib/transitions/vocab-labels";

import { mixLabel } from "./metrics";
import type {
  SequenceGapState,
  SequenceStep,
  SequenceStepBlock,
  SequenceStepTransition,
} from "./types";

export type DisplayGapState = SequenceGapState | "block" | "block-incomplete" | "block-broken";

/** A mix panel belongs on a linked transition join, never a block header or empty gap. */
export function canInspectMix(
  state: DisplayGapState | null,
  transition: SequenceStepTransition | null | undefined,
): boolean {
  return state === "linked" && transition != null;
}

export function displayGapState(
  step: Pick<SequenceStep, "gapState" | "inBlockId" | "inBlock">,
): DisplayGapState | null {
  if (step.gapState == null) return null;
  if (step.gapState === "seam") return "seam";
  if (step.inBlockId) {
    if (step.gapState === "linked") {
      return step.inBlock?.isComplete === false ? "block-incomplete" : "block";
    }
    return "block-broken";
  }
  return step.gapState;
}

export function gapChrome(state: DisplayGapState): {
  icon: string;
  railClass: string;
  rowClass: string;
  inkClass: string;
} {
  if (state === "linked") {
    return {
      icon: "⟶",
      railClass: "border-border",
      rowClass: "border-border bg-surface-1",
      inkClass: "text-foreground",
    };
  }
  if (state === "available") {
    return {
      icon: "⚠",
      railClass: "border-warning",
      rowClass: "border-warning-subtle bg-warning-subtle",
      inkClass: "text-warning",
    };
  }
  if (state === "unmapped") {
    return {
      icon: "○",
      railClass: "border-destructive",
      rowClass: "border-destructive-subtle bg-destructive-subtle",
      inkClass: "text-destructive",
    };
  }
  if (state === "block") {
    return {
      icon: "▸",
      railClass: "border-brand",
      rowClass: "border-brand bg-brand-subtle",
      inkClass: "text-brand",
    };
  }
  if (state === "block-incomplete") {
    return {
      icon: "▸",
      railClass: "border-warning",
      rowClass: "border-warning-subtle bg-warning-subtle",
      inkClass: "text-warning",
    };
  }
  if (state === "block-broken") {
    return {
      icon: "⚠",
      railClass: "border-destructive",
      rowClass: "border-destructive-subtle bg-destructive-subtle",
      inkClass: "text-destructive",
    };
  }
  return {
    icon: "〜",
    railClass: "border-muted-foreground",
    rowClass: "border-border bg-transparent",
    inkClass: "text-muted-foreground",
  };
}

export function availableGapLabel(
  transitionCount: number,
  candidateCount = transitionCount,
): string {
  const blockCount = Math.max(0, candidateCount - transitionCount);
  if (transitionCount > 0 && blockCount > 0) {
    return `${transitionCount} ${transitionCount === 1 ? "transition" : "transitions"} · ${blockCount} ${blockCount === 1 ? "block" : "blocks"} — pick one`;
  }
  if (blockCount > 0) {
    return `${blockCount} ${blockCount === 1 ? "block" : "blocks"} — pick one`;
  }
  return `${transitionCount} ${transitionCount === 1 ? "transition" : "transitions"} — pick one`;
}

export function blockConnectorLabel(
  block: SequenceStepBlock | null,
  fromTitle: string,
  toTitle: string,
): string {
  const title = block?.title?.trim() || "Block";
  const count = block?.stepCount ?? 0;
  return `${title} · ${count} ${count === 1 ? "track" : "tracks"} · ${fromTitle} → ${toTitle}`;
}

export function gapRowLabel(
  state: DisplayGapState,
  step: Pick<
    SequenceStep,
    "inTransition" | "inBlock" | "transitionCandidateCount" | "candidateCount"
  >,
  fromTitle: string,
  toTitle: string,
): string {
  if (state === "available") {
    return availableGapLabel(step.transitionCandidateCount, step.candidateCount);
  }
  if (state === "unmapped") return "no transition for this pair yet";
  if (state === "seam") return "open seam · improvise";
  if (state === "block" || state === "block-incomplete") {
    return blockConnectorLabel(step.inBlock, fromTitle, toTitle);
  }
  if (state === "block-broken") {
    const title = step.inBlock?.title?.trim() || "Block";
    return `${title} no longer fits this pair`;
  }
  const transition = step.inTransition;
  if (!transition) return "";
  return mixLabel({
    technique: displayVocab(transition.technique),
    fromBar: transition.fromBar,
    toBar: transition.toBar,
    barsOverlap: transition.barsOverlap,
  });
}

export function incompleteBlockCount(
  steps: readonly Pick<SequenceStep, "gapState" | "inBlockId" | "inBlock">[],
): number {
  let count = 0;
  for (const step of steps) {
    if (step.inBlockId && step.gapState === "linked" && step.inBlock?.isComplete === false) {
      count += 1;
    }
  }
  return count;
}
