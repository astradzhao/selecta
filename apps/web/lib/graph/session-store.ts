"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "selecta.graph-session.v2";
const LEGACY_STORAGE_KEY = "selecta.graph-session.v1";

export type GraphTrailHop = {
  trackId: string;
  inTransitionId: string | null;
  fromStepId?: string | null;
  fromAlternateId?: string | null;
};

export type GraphSessionState = {
  activeId: string | null;
  trail: GraphTrailHop[];
  sequenceId: string | null;
  versionId: string | null;
  stepId: string | null;
  alternateId: string | null;
};

export type GraphTrailSeedStep = {
  trackId: string;
  inTransitionId: string | null;
};

const EMPTY: GraphSessionState = {
  activeId: null,
  trail: [],
  sequenceId: null,
  versionId: null,
  stepId: null,
  alternateId: null,
};

let memory: GraphSessionState = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function optionalId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function isHop(value: unknown): value is GraphTrailHop {
  if (!value || typeof value !== "object") return false;
  const hop = value as { trackId?: unknown; inTransitionId?: unknown };
  if (typeof hop.trackId !== "string" || !hop.trackId) return false;
  return hop.inTransitionId == null || typeof hop.inTransitionId === "string";
}

function parseHop(value: unknown): GraphTrailHop | null {
  if (!isHop(value)) return null;
  const hop = value as GraphTrailHop;
  return {
    trackId: hop.trackId,
    inTransitionId: hop.inTransitionId ?? null,
    fromStepId: optionalId(hop.fromStepId),
    fromAlternateId: optionalId(hop.fromAlternateId),
  };
}

/** v1 payloads are track-id arrays and are dropped so saved trails stay linked. */
export function parseGraphSessionState(raw: string | null): GraphSessionState {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<GraphSessionState>;
    const activeId = typeof parsed.activeId === "string" ? parsed.activeId : null;
    if (!activeId || !Array.isArray(parsed.trail)) return EMPTY;
    if (parsed.trail.some((item) => typeof item === "string")) return EMPTY;
    const trail = parsed.trail.map(parseHop);
    if (trail.some((hop) => hop == null) || trail.length !== parsed.trail.length) return EMPTY;
    return {
      activeId,
      trail: trail as GraphTrailHop[],
      sequenceId: optionalId(parsed.sequenceId),
      versionId: optionalId(parsed.versionId),
      stepId: optionalId(parsed.stepId),
      alternateId: optionalId(parsed.alternateId),
    };
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

/** Start or jump to a track; clears the in-session trail and any Set-mode cursor. */
export function seedGraphSession(trackId: string) {
  hydrated = true;
  memory = { ...EMPTY, activeId: trackId };
  emit();
}

export function seedGraphSetSession(input: {
  sequenceId: string;
  versionId: string | null;
  stepId: string;
  trackId: string;
}) {
  hydrated = true;
  memory = {
    activeId: input.trackId,
    trail: [],
    sequenceId: input.sequenceId,
    versionId: input.versionId,
    stepId: input.stepId,
    alternateId: null,
  };
  emit();
}

export function setGraphSetCursor(input: { stepId: string | null; alternateId: string | null }) {
  hydrated = true;
  memory = { ...memory, stepId: input.stepId, alternateId: input.alternateId };
  emit();
}

export function clearGraphSetCursor() {
  hydrated = true;
  memory = {
    ...memory,
    sequenceId: null,
    versionId: null,
    stepId: null,
    alternateId: null,
  };
  emit();
}

export function setGraphActiveId(activeId: string | null) {
  hydrated = true;
  memory = activeId ? { ...memory, activeId } : EMPTY;
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
    ...memory,
    activeId: toId,
    trail: [
      ...memory.trail,
      {
        trackId: fromId,
        inTransitionId: transitionId,
        fromStepId: memory.stepId,
        fromAlternateId: memory.alternateId,
      },
    ],
  };
  emit();
}

/** Step back one hop. Returns the restored track id, or null if the trail is empty. */
export function popGraphTrail(): string | null {
  hydrated = true;
  if (memory.trail.length === 0) return null;
  const trail = memory.trail.slice(0, -1);
  const previous = memory.trail[memory.trail.length - 1]!;
  memory = {
    ...memory,
    activeId: previous.trackId,
    trail,
    stepId: previous.fromStepId ?? memory.stepId,
    alternateId: previous.fromAlternateId ?? null,
  };
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
