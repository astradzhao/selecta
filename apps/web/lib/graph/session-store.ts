"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "selecta.graph-session.v2";
const LEGACY_STORAGE_KEY = "selecta.graph-session.v1";

export type GraphTrailHop = {
  trackId: string;
  inTransitionId: string | null;
};

export type GraphSessionState = {
  activeId: string | null;
  trail: GraphTrailHop[];
};

export type GraphTrailSeedStep = {
  trackId: string;
  inTransitionId: string | null;
};

const EMPTY: GraphSessionState = { activeId: null, trail: [] };

let memory: GraphSessionState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function isHop(value: unknown): value is GraphTrailHop {
  if (!value || typeof value !== "object") return false;
  const hop = value as { trackId?: unknown; inTransitionId?: unknown };
  if (typeof hop.trackId !== "string" || !hop.trackId) return false;
  return hop.inTransitionId == null || typeof hop.inTransitionId === "string";
}

/** v1 payloads are track-id arrays and are dropped so saved trails stay linked. */
export function parseGraphSessionState(raw: string | null): GraphSessionState {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<GraphSessionState>;
    const activeId = typeof parsed.activeId === "string" ? parsed.activeId : null;
    if (!activeId || !Array.isArray(parsed.trail)) return EMPTY;
    if (parsed.trail.some((item) => typeof item === "string")) return EMPTY;
    const trail = parsed.trail.filter(isHop).map((hop) => ({
      trackId: hop.trackId,
      inTransitionId: hop.inTransitionId ?? null,
    }));
    if (trail.length !== parsed.trail.length) return EMPTY;
    return { activeId, trail };
  } catch {
    return EMPTY;
  }
}

/**
 * Seed for `POST /blocks { seed: { trail } }`.
 * Each hop's outbound edge becomes the next step's inbound transition.
 */
export function graphTrailToSequenceSeed(
  trail: GraphTrailHop[],
  activeId: string,
): GraphTrailSeedStep[] {
  const hops: GraphTrailHop[] = [...trail, { trackId: activeId, inTransitionId: null }];
  return hops.map((hop, index) => ({
    trackId: hop.trackId,
    inTransitionId: index === 0 ? null : hops[index - 1]!.inTransitionId,
  }));
}

function readStorage(): GraphSessionState {
  try {
    return parseGraphSessionState(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY;
  }
}

function writeStorage(state: GraphSessionState) {
  try {
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
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
export function hopGraphSession(fromId: string, toId: string, transitionId: string | null = null) {
  hydrated = true;
  if (fromId === toId) return;
  memory = {
    activeId: toId,
    trail: [...memory.trail, { trackId: fromId, inTransitionId: transitionId }],
  };
  emit();
}

/** Step back one hop. Returns the restored track id, or null if the trail is empty. */
export function popGraphTrail(): string | null {
  hydrated = true;
  if (memory.trail.length === 0) return null;
  const trail = memory.trail.slice(0, -1);
  const previous = memory.trail[memory.trail.length - 1]!;
  memory = { activeId: previous.trackId, trail };
  emit();
  return previous.trackId;
}

export function useGraphSession(): GraphSessionState {
  return useSyncExternalStore(
    subscribeGraphSession,
    getGraphSessionSnapshot,
    getGraphSessionServerSnapshot,
  );
}
