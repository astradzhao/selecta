"use client";

import { useEffect, useState } from "react";

import { GraphExplorer } from "@/components/tracks/graph-explorer";
import { GraphLanding } from "@/components/tracks/graph-landing";

/**
 * Single `/graph` session: landing when idle, explorer when a track is active.
 * Current node lives in memory — hops do not change the route.
 */
export function GraphSession({ initialTrackId }: { initialTrackId: string | null }) {
  const [activeId, setActiveId] = useState<string | null>(initialTrackId);

  // Seed from ?track= once, then drop the query so refresh returns to landing
  // and browser back leaves /graph instead of replaying seeded hops.
  useEffect(() => {
    if (!initialTrackId) return;
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("track=")) return;
    window.history.replaceState(null, "", "/graph");
  }, [initialTrackId]);

  if (!activeId) {
    return <GraphLanding onStart={setActiveId} />;
  }

  return (
    <GraphExplorer
      trackId={activeId}
      onTrackIdChange={setActiveId}
      onExit={() => setActiveId(null)}
    />
  );
}
