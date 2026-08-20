"use client";

import { useEffect, useRef, useState } from "react";

/** Standard search/filter delay. First update is still immediate (see hook). */
export const DEFAULT_DEBOUNCE_MS = 220;

/**
 * Returns `value` immediately on the first render, then debounces later updates.
 * List views rely on the first-call-immediate behavior so they can fetch before
 * painting an empty state.
 */
export function useDebouncedValue<T>(value: T, delayMs: number = DEFAULT_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    const handle = setTimeout(() => setDebounced(value), Math.max(0, delayMs));
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
