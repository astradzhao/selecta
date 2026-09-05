"use client";

import { useEffect, useState } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { useToast } from "@selecta/ui/components/toast";

import { GraphExplorer } from "@/components/graph/graph-explorer";
import { GraphLanding } from "@/components/graph/graph-landing";
import { describeApiError } from "@/lib/api/errors";
import {
  clearGraphSession,
  seedGraphSession,
  seedGraphSetSession,
  useGraphSession,
} from "@/lib/graph/session-store";
import { getSequence } from "@/lib/sequences/api";

function stripGraphQuery() {
  if (typeof window === "undefined" || !window.location.search) return;
  window.history.replaceState(null, "", "/graph");
}

/**
 * Single `/graph` session: landing when idle, explorer when a track is active.
 * Current node + trail persist in sessionStorage across in-app navigations.
 */
export function GraphSession({
  initialTrackId,
  initialSetId,
  initialVersionId,
  initialStepId,
}: {
  initialTrackId: string | null;
  initialSetId: string | null;
  initialVersionId: string | null;
  initialStepId: string | null;
}) {
  const { activeId } = useGraphSession();
  const { toast } = useToast();
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialSetId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getSequence(initialSetId, {
          expand: true,
          versionId: initialVersionId,
        });
        const entries = result.sequence.expansion?.entries ?? [];
        if (cancelled) return;
        if (entries.length === 0) {
          toast("Add a track before opening in graph.");
          stripGraphQuery();
          return;
        }
        const match = initialStepId
          ? entries.find((entry) => entry.stepId === initialStepId)
          : null;
        const entry = match ?? entries[0]!;
        seedGraphSetSession({
          sequenceId: result.sequence.id,
          versionId: initialVersionId,
          stepId: entry.stepId,
          trackId: entry.trackId,
        });
        stripGraphQuery();
      } catch (err) {
        if (cancelled) return;
        setSeedError(describeApiError(err, { fallback: "Set not found." }));
        stripGraphQuery();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialSetId, initialVersionId, initialStepId, toast]);

  useEffect(() => {
    if (initialSetId || !initialTrackId) return;
    seedGraphSession(initialTrackId);
    stripGraphQuery();
  }, [initialSetId, initialTrackId]);

  if (!activeId) {
    return (
      <div className="space-y-4">
        {seedError ? <Alert variant="destructive">{seedError}</Alert> : null}
        <GraphLanding onStart={seedGraphSession} />
      </div>
    );
  }

  return <GraphExplorer onExit={clearGraphSession} />;
}
