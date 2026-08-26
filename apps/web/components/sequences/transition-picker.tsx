"use client";

import { useEffect, useMemo, useState } from "react";
import { compareNeighborhoodNeighbors } from "@selecta/library/neighborhood-rank";

import { Badge } from "@selecta/ui/components/badge";
import { cn } from "@selecta/ui/lib/utils";

import { listTransitions } from "@/lib/transitions/api";
import type { ApiTransition } from "@/lib/transitions/types";
import { displayVocab, qualityRankTone } from "@/lib/transitions/vocab-labels";

function rankTransitions(items: ApiTransition[]): ApiTransition[] {
  return items.slice().sort((a, b) =>
    compareNeighborhoodNeighbors(
      {
        track: { title: a.toTrack.title },
        transition: {
          id: a.id,
          proposalKey: a.proposalKey,
          confidence: a.confidence,
          fromBar: a.fromBar,
          quality: a.quality,
        },
      },
      {
        track: { title: b.toTrack.title },
        transition: {
          id: b.id,
          proposalKey: b.proposalKey,
          confidence: b.confidence,
          fromBar: b.fromBar,
          quality: b.quality,
        },
      },
    ),
  );
}

export function TransitionPicker({
  fromTrackId,
  toTrackId,
  fromTitle,
  toTitle,
  onPick,
}: {
  fromTrackId: string;
  toTrackId: string;
  fromTitle: string;
  toTitle: string;
  onPick: (transition: ApiTransition) => void;
}) {
  const [items, setItems] = useState<ApiTransition[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await listTransitions({
          fromTrackId,
          toTrackId,
          limit: 50,
        });
        if (!cancelled) {
          setItems(rankTransitions(result.transitions));
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load transitions for this pair.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromTrackId, toTrackId]);

  const ranked = useMemo(() => items ?? [], [items]);

  return (
    <div className="border-border bg-popover flex flex-col gap-0.5 rounded-xl border p-2 duration-fast">
      <span className="text-eyebrow px-2 py-1">
        {fromTitle} → {toTitle}
      </span>
      {error ? <p className="text-caption text-destructive px-2 py-1">{error}</p> : null}
      {items && ranked.length === 0 ? (
        <p className="text-caption px-2 py-1">No transitions for this pair yet.</p>
      ) : null}
      {ranked.map((transition) => {
        const technique = displayVocab(transition.technique) ?? "mix";
        const bars = transition.barsOverlap != null ? `${transition.barsOverlap} bars` : null;
        const tone = qualityRankTone(transition.quality);
        return (
          <button
            key={transition.id}
            type="button"
            className={cn(
              "hover:bg-surface-2 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm",
            )}
            onClick={() => onPick(transition)}
          >
            <span className="text-brand">⟶</span>
            <span>
              {technique}
              {bars ? ` · ${bars}` : ""}
            </span>
            {transition.quality ? (
              <Badge variant={tone ?? "tertiary"} className="ml-auto">
                {displayVocab(transition.quality)}
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
