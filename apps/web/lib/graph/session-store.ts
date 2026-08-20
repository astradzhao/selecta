"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "selecta.graph-session.v1";

export type GraphSessionState = {
  activeId: string | null;
  trail: string[];
};

const EMPTY: GraphSessionState = { activeId: null, trail: [] };

let memory: GraphSessionState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): GraphSessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<GraphSessionState>;
    const activeId = typeof parsed.activeId === "string" ? parsed.activeId : null;
    const trail = Array.isArray(parsed.trail)
      ? parsed.trail.filter((id): id is string => typeof id === "string")
      : [];
    return { activeId, trail: activeId ? trail : [] };
  } catch {
    return EMPTY;
  }
}

function writeStorage(state: GraphSessionState) {
  try {
    if (!state.activeId) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota — memory still works for the current tab life.
  }
}

/**
 * Restore from sessionStorage after the first paint so SSR/hydration stay on
 * EMPTY (matching getServerSnapshot). Soft navigations keep module memory.
 */
function scheduleHydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  queueMicrotask(() => {
    // Prefer in-memory session (SPA); fall back to storage (reload).
    if (!memory.activeId) {
      memory = readStorage();
    }
    writeStorage(memory);
    for (const listener of listeners) listener();
  });
}

function emit() {
  writeStorage(memory);
  for (const listener of listeners) listener();
}

export function getGraphSessionSnapshot(): GraphSessionState {
  return memory;
}

export function getGraphSessionServerSnapshot(): GraphSessionState {
  return EMPTY;
}

export function subscribeGraphSession(onStoreChange: () => void): () => void {
  scheduleHydrate();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Start or jump to a track; clears the in-session trail. */
export function seedGraphSession(trackId: string) {
  hydrated = true;
  memory = { activeId: trackId, trail: [] };
  emit();
}

export function setGraphActiveId(activeId: string | null) {
  hydrated = true;
  memory = activeId ? { activeId, trail: memory.trail } : EMPTY;
  emit();
}

/** Clear current node and trail (Exit). */
export function clearGraphSession() {
  hydrated = true;
  memory = EMPTY;
  emit();
}

/** Traverse forward: push `fromId` onto the trail and make `toId` current. */
export function hopGraphSession(fromId: string, toId: string) {
  hydrated = true;
  if (fromId === toId) return;
  memory = { activeId: toId, trail: [...memory.trail, fromId] };
  emit();
}

/** Step back one hop. Returns the restored track id, or null if the trail is empty. */
export function popGraphTrail(): string | null {
  hydrated = true;
  if (memory.trail.length === 0) return null;
  const trail = memory.trail.slice(0, -1);
  const previous = memory.trail[memory.trail.length - 1]!;
  memory = { activeId: previous, trail };
  emit();
  return previous;
}

export function useGraphSession(): GraphSessionState {
  return useSyncExternalStore(
    subscribeGraphSession,
    getGraphSessionSnapshot,
    getGraphSessionServerSnapshot,
  );
}
