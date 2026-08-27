/**
 * Sequence runtime in seconds. Pure — no db — so the domain layer and the
 * workspace header share one formula (`@selecta/library/sequence-runtime`).
 *
 * A live block unit (host step `gapState === "linked"` with `inBlock`)
 * contributes the child's `runtimeSec` once, covering both endpoint tracks
 * and the interior. Transition overlap is subtracted only on linked
 * transition joins.
 */

export type SequenceRuntimeStep = {
  gapState: "linked" | "available" | "unmapped" | "seam" | null;
  track: { durationSec: number | null; bpm: number | null } | null;
  inTransition: { barsOverlap: number | null } | null;
  inBlock?: { runtimeSec: number } | null;
};

function isLiveBlockHost(step: SequenceRuntimeStep): boolean {
  return Boolean(step.inBlock && step.gapState === "linked");
}

export function sequenceRuntimeSec(steps: readonly SequenceRuntimeStep[]): number {
  let total = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const next = steps[i + 1];
    if (isLiveBlockHost(step)) {
      total += step.inBlock!.runtimeSec;
      continue;
    }
    if (next && isLiveBlockHost(next)) {
      continue;
    }
    const duration = step.track?.durationSec;
    if (duration != null && Number.isFinite(duration)) total += duration;
  }
  for (let i = 1; i < steps.length; i++) {
    const dest = steps[i]!;
    const prev = steps[i - 1]!;
    if (dest.gapState !== "linked" || dest.inBlock) continue;
    const overlap = dest.inTransition?.barsOverlap;
    const bpm = prev.track?.bpm;
    if (
      overlap == null ||
      bpm == null ||
      !Number.isFinite(overlap) ||
      !Number.isFinite(bpm) ||
      bpm <= 0
    ) {
      continue;
    }
    total -= (overlap * 4 * 60) / bpm;
  }
  return Math.max(0, total);
}

export function sequenceTrackCount(
  steps: readonly { inBlock?: { stepCount: number } | null; gapState?: string | null }[],
): number {
  let count = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const next = steps[i + 1];
    const host = Boolean(step.inBlock && step.gapState === "linked");
    const anchor = Boolean(next?.inBlock && next.gapState === "linked");
    if (host) {
      count += step.inBlock!.stepCount;
      continue;
    }
    if (anchor) continue;
    count += 1;
  }
  return count;
}
