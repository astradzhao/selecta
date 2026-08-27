type UnitStep = {
  inBlockId?: string | null;
  gapState?: string | null;
};

/** A live block unit is a linked host whose inbound connector is a block. Broken pins are not units. */
export function isLiveBlockHost(step: unknown): boolean {
  if (!step || typeof step !== "object") return false;
  const row = step as UnitStep;
  return Boolean(row.inBlockId && row.gapState === "linked");
}

/** Inclusive [start, end] of the movable unit containing step `i`. */
export function unitRange(steps: readonly unknown[], i: number): [number, number] {
  const step = steps[i];
  if (isLiveBlockHost(step) && i > 0) return [i - 1, i];
  const next = steps[i + 1];
  if (isLiveBlockHost(next)) return [i, i + 1];
  return [i, i];
}

/**
 * 0-based display index for the unit containing step `i`.
 * A live block unit shares one number across its anchor and host.
 */
export function unitDisplayIndex(steps: readonly unknown[], i: number): number {
  let n = 0;
  for (let j = 0; j <= i; j++) {
    const [start] = unitRange(steps, j);
    if (start === j) n += 1;
  }
  return Math.max(0, n - 1);
}

export function moveUnit<T>(steps: readonly T[], i: number, delta: -1 | 1): T[] {
  if (i < 0 || i >= steps.length) return [...steps];
  const [start, end] = unitRange(steps, i);
  if (delta < 0) {
    if (start === 0) return [...steps];
    const [dest] = unitRange(steps, start - 1);
    return spliceUnit(steps, start, end, dest);
  }
  if (end === steps.length - 1) return [...steps];
  const [, neighborEnd] = unitRange(steps, end + 1);
  const length = end - start + 1;
  return spliceUnit(steps, start, end, neighborEnd - length + 1);
}

/**
 * Place the dragged unit on the drop target: before it when moving up, after it
 * when moving down, so dropping on the next card swaps the two.
 */
export function reorderTo<T>(steps: readonly T[], fromIndex: number, targetIndex: number): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= steps.length ||
    targetIndex < 0 ||
    targetIndex >= steps.length
  ) {
    return [...steps];
  }
  const [start, end] = unitRange(steps, fromIndex);
  if (targetIndex >= start && targetIndex <= end) return [...steps];
  const [targetStart, targetEnd] = unitRange(steps, targetIndex);
  const next = steps.slice();
  const chunk = next.splice(start, end - start + 1);
  const dest = start < targetStart ? targetEnd - chunk.length + 1 : targetStart;
  next.splice(dest, 0, ...chunk);
  return next;
}

function spliceUnit<T>(steps: readonly T[], start: number, end: number, dest: number): T[] {
  const next = steps.slice();
  const chunk = next.splice(start, end - start + 1);
  next.splice(dest, 0, ...chunk);
  return next;
}
