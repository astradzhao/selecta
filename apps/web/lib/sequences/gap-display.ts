import type { SequenceGapState, SequenceStep } from "./types";

export type DisplayGapState = SequenceGapState | "block";

export function displayGapState(
  step: Pick<
    SequenceStep,
    "gapState" | "inBlockId" | "inTransitionId" | "transitionCandidateCount"
  >,
): DisplayGapState | null {
  if (step.gapState == null) return null;
  if (step.gapState === "seam") return "seam";
  if (step.gapState === "linked") return "linked";
  if (step.inBlockId && !step.inTransitionId) return "block";
  if (step.gapState === "available" && step.transitionCandidateCount === 0) return "unmapped";
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
      railClass: "border-border",
      rowClass: "border-border bg-surface-1",
      inkClass: "text-muted-foreground",
    };
  }
  return {
    icon: "〜",
    railClass: "border-muted-foreground",
    rowClass: "border-border bg-transparent",
    inkClass: "text-muted-foreground",
  };
}

export function availableGapLabel(count: number): string {
  return `${count} ${count === 1 ? "transition" : "transitions"} — pick one`;
}
