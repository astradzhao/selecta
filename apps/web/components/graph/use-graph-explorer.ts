"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import type { CopyPhase } from "@/components/graph/copy-phase";
import { describeApiError } from "@/lib/api/errors";
import { getTrackNeighborhood } from "@/lib/graph/api";
import { hopGraphSession, popGraphTrail, useGraphSession } from "@/lib/graph/session-store";
import type { ApiNeighborhoodCurrent, ApiNeighborhoodNeighbor } from "@/lib/graph/types";
import {
  beginArtFlight,
  HERO_ART_SIZE,
  HOP_COPY_IN_MS,
  HOP_COPY_OUT_MS,
  HOP_FLIGHT_MS,
  nextFrame,
  prefersReducedMotion,
  wait,
} from "@/lib/motion";

type Neighborhood = {
  current: ApiNeighborhoodCurrent;
  neighbors: ApiNeighborhoodNeighbor[];
};

export function useGraphExplorer() {
  const { activeId: trackId, trail } = useGraphSession();
  const baseId = useId();
  const [current, setCurrent] = useState<ApiNeighborhoodCurrent | null>(null);
  const [neighbors, setNeighbors] = useState<ApiNeighborhoodNeighbor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startLoad] = useTransition();
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [artHidden, setArtHidden] = useState(false);
  const [copyPhase, setCopyPhase] = useState<CopyPhase>("visible");

  const loadedIdRef = useRef<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const requestsRef = useRef(new Map<string, Promise<Neighborhood>>());

  function loadNeighborhood(id: string, { bust = false } = {}): Promise<Neighborhood> {
    if (bust) requestsRef.current.delete(id);
    const inFlight = requestsRef.current.get(id);
    if (inFlight) return inFlight;
    const request = getTrackNeighborhood(id).then((response) => ({
      current: response.current,
      neighbors: response.neighbors,
    }));
    requestsRef.current.set(id, request);
    void request.catch(() => requestsRef.current.delete(id));
    return request;
  }

  async function refreshNeighborhood() {
    if (!trackId) return;
    const next = await loadNeighborhood(trackId, { bust: true });
    setCurrent(next.current);
    setNeighbors(next.neighbors);
    setError(null);
  }

  useEffect(() => {
    if (!trackId || loadedIdRef.current === trackId) return;
    let cancelled = false;
    startLoad(async () => {
      try {
        const next = await loadNeighborhood(trackId);
        if (cancelled) return;
        loadedIdRef.current = trackId;
        setCurrent(next.current);
        setNeighbors(next.neighbors);
        setError(null);
        setAdding(false);
      } catch (err) {
        if (cancelled) return;
        setCurrent(null);
        setNeighbors([]);
        setError(describeApiError(err, { fallback: "Failed to load graph neighborhood." }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  async function goToTrack(nextId: string, sourceElement?: HTMLElement | null) {
    if (!trackId || choosingId || nextId === trackId) return;

    const request = loadNeighborhood(nextId).catch(() => null);
    const flight = beginArtFlight(
      sourceElement?.querySelector<HTMLElement>('[data-art-role="card"]'),
    );

    setChoosingId(nextId);
    setExpandedKey(null);
    setAdding(false);
    setCopyPhase("out");
    if (flight) setArtHidden(true);

    try {
      const next = await request;
      await wait(prefersReducedMotion() ? 0 : HOP_COPY_OUT_MS);

      loadedIdRef.current = next ? nextId : null;
      hopGraphSession(trackId, nextId);
      if (next) {
        setCurrent(next.current);
        setNeighbors(next.neighbors);
        setError(null);
      }
      setChoosingId(null);
      setCopyPhase("hidden");

      await nextFrame();
      const heroArt = panelRef.current?.querySelector<HTMLElement>('[data-art-role="hero"]');

      if (flight && heroArt) {
        await flight.landOn(heroArt, { duration: HOP_FLIGHT_MS, size: HERO_ART_SIZE });
      } else {
        await wait(prefersReducedMotion() ? 0 : HOP_FLIGHT_MS);
      }

      setArtHidden(false);
      await nextFrame();
      const heroImg = panelRef.current?.querySelector<HTMLImageElement>(
        '[data-art-role="hero"] img',
      );
      if (heroImg && !(heroImg.complete && heroImg.naturalWidth > 0)) {
        await Promise.race([
          new Promise<void>((resolve) => {
            heroImg.addEventListener("load", () => resolve(), { once: true });
            heroImg.addEventListener("error", () => resolve(), { once: true });
          }),
          wait(400),
        ]);
      }
      await nextFrame();
      if (flight) {
        await flight.fadeOut(prefersReducedMotion() ? 0 : 160);
        flight.destroy();
      }
      setCopyPhase("in");
      await wait(prefersReducedMotion() ? 0 : HOP_COPY_IN_MS);
      setCopyPhase("visible");
    } finally {
      setArtHidden(false);
      setCopyPhase("visible");
      if (flight) flight.destroy();
    }
  }

  function goBackInTrail() {
    if (choosingId) return;
    const previous = popGraphTrail();
    if (!previous) return;
    loadedIdRef.current = null;
    setExpandedKey(null);
    setAdding(false);
    setCopyPhase("visible");
  }

  return {
    trackId,
    trail,
    baseId,
    current,
    neighbors,
    error,
    expandedKey,
    adding,
    pending,
    choosingId,
    artHidden,
    copyPhase,
    panelRef,
    refreshNeighborhood,
    loadNeighborhood,
    goToTrack,
    goBackInTrail,
    setAdding,
    setExpandedKey,
    registerCardRef(rowKey: string, element: HTMLElement | null) {
      if (element) cardRefs.current.set(rowKey, element);
      else cardRefs.current.delete(rowKey);
    },
    cardElement(rowKey: string) {
      return cardRefs.current.get(rowKey);
    },
  };
}
