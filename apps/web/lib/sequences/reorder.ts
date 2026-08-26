/** Inclusive [start, end] of the movable unit containing step `i`. SET-4 is always one step. */
export function unitRange(_steps: readonly unknown[], i: number): [number, number] {
  return [i, i];
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

/** Place the unit at `fromIndex` immediately before the unit at `targetIndex`. */
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
  const [targetStart] = unitRange(steps, targetIndex);
  const next = steps.slice();
  const chunk = next.splice(start, end - start + 1);
  const dest = start < targetStart ? targetStart - chunk.length : targetStart;
  next.splice(dest, 0, ...chunk);
  return next;
}

function spliceUnit<T>(steps: readonly T[], start: number, end: number, dest: number): T[] {
  const next = steps.slice();
  const chunk = next.splice(start, end - start + 1);
  next.splice(dest, 0, ...chunk);
  return next;
}
