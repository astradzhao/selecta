"use client";

import { useEffect, useMemo, useState } from "react";
import { compareNeighborhoodNeighbors } from "@selecta/library/neighborhood-rank";

import { Badge } from "@selecta/ui/components/badge";
import { cn } from "@selecta/ui/lib/utils";

import { listSequences } from "@/lib/sequences/api";
import type { SequenceRecord } from "@/lib/sequences/types";
import { listTransitions } from "@/lib/transitions/api";
import type { ApiTransition } from "@/lib/transitions/types";
import { displayVocab, qualityRankTone } from "@/lib/transitions/vocab-labels";

import { MixHeadline } from "./mix-headline";

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

export function ConnectorPicker({
  fromTrackId,
  toTrackId,
  fromTitle,
  toTitle,
  excludeSequenceId,
  onPickTransition,
  onPickBlock,
}: {
  fromTrackId: string;
  toTrackId: string;
  fromTitle: string;
  toTitle: string;
  excludeSequenceId: string;
  onPickTransition: (transition: ApiTransition) => void;
  onPickBlock: (block: SequenceRecord) => void;
}) {
  const [transitions, setTransitions] = useState<ApiTransition[] | null>(null);
  const [blocks, setBlocks] = useState<SequenceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [transitionResult, blockResult] = await Promise.all([
          listTransitions({ fromTrackId, toTrackId, limit: 50 }),
          listSequences({
            kind: "block",
            startTrack: fromTrackId,
            endTrack: toTrackId,
            complete: true,
            limit: 50,
          }),
        ]);
        if (cancelled) return;
        setTransitions(rankTransitions(transitionResult.transitions));
        setBlocks(
          blockResult.sequences.filter((row) => row.id !== excludeSequenceId && row.isComplete),
        );
        setError(null);
      } catch {
        if (!cancelled) setError("Could not load connectors for this pair.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excludeSequenceId, fromTrackId, toTrackId]);

  const ranked = useMemo(() => transitions ?? [], [transitions]);
  const blockRows = useMemo(() => blocks ?? [], [blocks]);
  const loaded = transitions != null && blocks != null;

  return (
    <div className="border-border bg-popover flex flex-col gap-0.5 rounded-xl border p-2 duration-fast">
      <span className="text-eyebrow px-2 py-1">
        {fromTitle} → {toTitle}
      </span>
      {error ? <p className="text-caption text-destructive px-2 py-1">{error}</p> : null}
      {loaded && ranked.length === 0 && blockRows.length === 0 ? (
        <p className="text-caption px-2 py-1">No transitions or blocks for this pair yet.</p>
      ) : null}
      {ranked.map((transition) => {
        const tone = qualityRankTone(transition.quality);
        return (
          <button
            key={transition.id}
            type="button"
            className={cn(
              "hover:bg-surface-2 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
            )}
            onClick={() => onPickTransition(transition)}
          >
            <MixHeadline className="min-w-0 flex-1" transition={transition} />
            {transition.quality ? (
              <Badge variant={tone ?? "tertiary"} className="ml-auto">
                {displayVocab(transition.quality)}
              </Badge>
            ) : null}
          </button>
        );
      })}
      {blockRows.map((block) => (
        <button
          key={block.id}
          type="button"
          className={cn(
            "hover:bg-surface-2 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm",
          )}
          onClick={() => onPickBlock(block)}
        >
          <span className="text-brand">▸</span>
          <span className="min-w-0 truncate font-medium">{block.title}</span>
          <span className="text-caption ml-auto shrink-0">
            {block.stepCount} {block.stepCount === 1 ? "track" : "tracks"}
          </span>
        </button>
      ))}
    </div>
  );
}
