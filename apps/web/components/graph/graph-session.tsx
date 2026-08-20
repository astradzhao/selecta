"use client";

import { useEffect } from "react";

import { GraphExplorer } from "@/components/graph/graph-explorer";
import { GraphLanding } from "@/components/graph/graph-landing";
import { clearGraphSession, seedGraphSession, useGraphSession } from "@/lib/graph/session-store";

/**
 * Single `/graph` session: landing when idle, explorer when a track is active.
 * Current node + trail persist in sessionStorage across in-app navigations.
 */
export function GraphSession({ initialTrackId }: { initialTrackId: string | null }) {
  const { activeId } = useGraphSession();

  // Explicit entry (?track= / Open in graph) seeds a fresh session, then drops
  // the query so refresh of /graph restores from storage instead of re-seeding.
  useEffect(() => {
    if (!initialTrackId) return;
    seedGraphSession(initialTrackId);
    if (typeof window !== "undefined" && window.location.search.includes("track=")) {
      window.history.replaceState(null, "", "/graph");
    }
  }, [initialTrackId]);

  if (!activeId) {
    return <GraphLanding onStart={seedGraphSession} />;
  }

  return <GraphExplorer onExit={clearGraphSession} />;
}
