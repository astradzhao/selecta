"use client";

import type { DragEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { compareNeighborhoodNeighbors } from "@selecta/library/neighborhood-rank";
import { PlusIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { SearchField } from "@selecta/ui/components/search-field";
import { SegmentedTab, SegmentedTabs } from "@selecta/ui/components/segmented-tabs";
import { cn } from "@selecta/ui/lib/utils";

import { FilterField } from "@/components/common/filtered-list-shell";
import { useFilteredList } from "@/hooks/use-filtered-list";
import { artistLine } from "@/lib/format";
import {
  numericInsertIndex,
  paletteAddTitle,
  paletteTransitionQuery,
  paletteTransitionReason,
  type FitPayload,
} from "@/lib/sequences/drag";
import type { SequenceStep, WorkspaceSelection } from "@/lib/sequences/types";
import { listTracks, type ApiTrack } from "@/lib/tracks/api";
import { listTransitions } from "@/lib/transitions/api";
import type { ApiTransition } from "@/lib/transitions/types";
import { displayVocab, qualityRankTone } from "@/lib/transitions/vocab-labels";

export type PaletteTab = "tracks" | "transitions";

function transitionPayload(transition: ApiTransition): Extract<FitPayload, { kind: "transition" }> {
  return {
    kind: "transition",
    id: transition.id,
    fromTrackId: transition.fromTrack.id,
    toTrackId: transition.toTrack.id,
    fromTitle: transition.fromTrack.title,
    toTitle: transition.toTrack.title,
    technique: displayVocab(transition.technique) ?? "mix",
  };
}

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

function startPaletteDrag(event: DragEvent, payload: FitPayload) {
  event.dataTransfer.setData("text/plain", payload.id);
  event.dataTransfer.effectAllowed = "copyMove";
}

export function LibraryPalette({
  selection,
  steps,
  tab,
  onTab,
  onAddTrack,
  onAddTransition,
  onClearSelection,
  onDragStart,
  onDragEnd,
}: {
  selection: WorkspaceSelection;
  steps: SequenceStep[];
  tab: PaletteTab;
  onTab: (tab: PaletteTab) => void;
  onAddTrack: (track: ApiTrack) => void;
  onAddTransition: (transition: ApiTransition) => void;
  onClearSelection: () => void;
  onDragStart: (payload: FitPayload) => void;
  onDragEnd: () => void;
}) {
  const [query, setQuery] = useState("");
  const trackFilters = useMemo(() => ({ query }), [query]);
  const { fromTrackId, toTrackId } = paletteTransitionQuery(selection, steps);
  const transitionFilters = useMemo(
    () => ({ query, fromTrackId, toTrackId }),
    [query, fromTrackId, toTrackId],
  );

  const fetchTracks = useCallback(async (next: { query: string }) => {
    const result = await listTracks({ query: next.query, limit: 50 });
    return { items: result.tracks, hasMore: Boolean(result.hasMore) };
  }, []);

  const fetchTransitions = useCallback(
    async (next: { query: string; fromTrackId?: string; toTrackId?: string }) => {
      const result = await listTransitions({
        query: next.query,
        fromTrackId: next.fromTrackId,
        toTrackId: next.toTrackId,
        limit: 50,
      });
      return { items: rankTransitions(result.transitions), hasMore: result.hasMore };
    },
    [],
  );

  const tracks = useFilteredList({
    filters: trackFilters,
    fetchPage: fetchTracks,
    resource: "tracks",
  });
  const transitions = useFilteredList({
    filters: transitionFilters,
    fetchPage: fetchTransitions,
    resource: "transitions",
  });

  const gapIndex =
    selection.kind === "gap" ? steps.findIndex((step) => step.id === selection.stepId) : -1;
  const fromStep = gapIndex > 0 ? steps[gapIndex - 1] : null;
  const toStep = gapIndex > 0 ? steps[gapIndex] : null;
  const insertAt = numericInsertIndex(selection, steps);
  const anchor = insertAt > 0 ? steps[insertAt - 1] : null;
  const gapSelected = Boolean(fromStep && toStep);
  const hasContext = gapSelected || (tab === "transitions" && Boolean(anchor));
  const contextLabel = gapSelected
    ? `Fits the selected gap · ${fromStep?.track?.title ?? "Track"} → ${toStep?.track?.title ?? "Track"}`
    : anchor
      ? `Out of ${anchor.track?.title ?? "Track"}${selection.kind === "none" ? " · end of the set" : ""}`
      : "";

  const hint =
    tab === "transitions" && !gapSelected
      ? anchor
        ? `+ adds the transition and the track it lands on, after ${anchor.track?.title ?? "this track"}.`
        : "+ starts the set with both tracks of the transition."
      : selection.kind === "gap"
        ? "+ links a matching transition, or inserts a track at this position."
        : selection.kind === "step"
          ? "+ inserts after the selected step."
          : "Read-only over your library. + appends to the end of the running order.";

  const items = tab === "tracks" ? tracks : transitions;
  const emptyText =
    tab === "transitions" && gapSelected
      ? "No transition exists for this pair yet — author one from Library › Add transition."
      : tab === "transitions" && anchor
        ? `Nothing out of ${anchor.track?.title ?? "this track"} yet. Add one from Library › Add transition, or select an earlier step to extend from there.`
        : "Nothing matches that search.";

  return (
    <aside className="border-border bg-card lg:sticky lg:top-20 flex min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="border-border flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
        <span className="text-eyebrow">Library</span>
        <SegmentedTabs variant="boxed" aria-label="Palette">
          <SegmentedTab type="button" active={tab === "tracks"} onClick={() => onTab("tracks")}>
            Tracks
          </SegmentedTab>
          <SegmentedTab
            type="button"
            active={tab === "transitions"}
            onClick={() => onTab("transitions")}
          >
            Transitions
          </SegmentedTab>
        </SegmentedTabs>
      </div>
      <div className="border-border border-b px-3.5 py-2.5">
        <FilterField htmlFor="palette-q" label="Search">
          <SearchField
            id="palette-q"
            placeholder={tab === "tracks" ? "Search tracks" : "Search transitions"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </FilterField>
      </div>
      {hasContext ? (
        <div className="border-border bg-brand-subtle flex items-center gap-2 border-b px-3.5 py-2">
          <span className="text-brand min-w-0 text-sm font-medium">{contextLabel}</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-brand ml-auto"
            onClick={onClearSelection}
          >
            clear
          </Button>
        </div>
      ) : null}
      <div className="flex max-h-[32.5rem] flex-col overflow-y-auto">
        {!items.hasFetched && !items.error ? (
          <p className="text-caption px-3.5 py-4">Loading…</p>
        ) : items.error ? (
          <p className="text-caption text-destructive px-3.5 py-4">{items.error}</p>
        ) : items.items.length === 0 ? (
          <p className="text-caption px-3.5 py-6">{emptyText}</p>
        ) : tab === "tracks" ? (
          (tracks.items as ApiTrack[]).map((track) => {
            const payload: FitPayload = { kind: "track", id: track.id, title: track.title };
            return (
              <PaletteRow
                key={track.id}
                icon={track.title.slice(0, 1).toUpperCase()}
                title={track.title}
                sub={artistLine(track.artists)}
                meta={
                  track.bpm != null
                    ? `${Math.round(track.bpm)}${track.musicalKey ? ` · ${track.musicalKey}` : ""}`
                    : (track.musicalKey ?? "")
                }
                addTitle={paletteAddTitle(payload, selection, steps)}
                disabled={false}
                onAdd={() => onAddTrack(track)}
                onDragStart={(event) => {
                  startPaletteDrag(event, payload);
                  onDragStart(payload);
                }}
                onDragEnd={onDragEnd}
              />
            );
          })
        ) : (
          (transitions.items as ApiTransition[]).map((transition) => {
            const payload = transitionPayload(transition);
            const reason = paletteTransitionReason(payload, selection, steps);
            const tone = qualityRankTone(transition.quality);
            return (
              <PaletteRow
                key={transition.id}
                icon="⟶"
                iconClass={
                  tone === "success"
                    ? "bg-success-subtle text-success"
                    : tone === "warning"
                      ? "bg-warning-subtle text-warning"
                      : "bg-tertiary text-tertiary-foreground"
                }
                title={`${payload.technique}${
                  transition.barsOverlap != null ? ` · ${transition.barsOverlap} bars` : ""
                }`}
                sub={`${transition.fromTrack.title} → ${transition.toTrack.title}`}
                meta={displayVocab(transition.quality) ?? ""}
                addTitle={paletteAddTitle(payload, selection, steps)}
                disabled={Boolean(reason)}
                onAdd={() => onAddTransition(transition)}
                onDragStart={(event) => {
                  startPaletteDrag(event, payload);
                  onDragStart(payload);
                }}
                onDragEnd={onDragEnd}
              />
            );
          })
        )}
      </div>
      <p className="border-border text-caption border-t px-3.5 py-2.5">{hint}</p>
    </aside>
  );
}

function PaletteRow({
  icon,
  iconClass,
  title,
  sub,
  meta,
  addTitle,
  disabled,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  icon: string;
  iconClass?: string;
  title: string;
  sub: string;
  meta: string;
  addTitle: string;
  disabled: boolean;
  onAdd: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable={!disabled}
      title={disabled ? addTitle : "Drag into the running order"}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "border-border grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-2.5 border-b px-3.5 py-2",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "bg-surface-3 text-muted-foreground flex size-7 cursor-grab items-center justify-center rounded-md text-xs font-semibold",
          iconClass,
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="text-caption truncate">{sub}</span>
      </span>
      <span className="text-crate-meta">{meta}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={addTitle}
        disabled={disabled}
        onClick={onAdd}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
