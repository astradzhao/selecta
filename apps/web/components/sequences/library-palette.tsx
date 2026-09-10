"use client";

import type { DragEvent, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { compareNeighborhoodNeighbors } from "@selecta/library/neighborhood-rank";
import { PlusIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { SearchField } from "@selecta/ui/components/search-field";
import { SegmentedTab, SegmentedTabs } from "@selecta/ui/components/segmented-tabs";
import { cn } from "@selecta/ui/lib/utils";

import { FilterField } from "@/components/common/filtered-list-shell";
import { AddTrackDialog } from "@/components/tracks/add-track-dialog";
import { useFilteredList } from "@/hooks/use-filtered-list";
import { artistLine } from "@/lib/format";
import { listSequences } from "@/lib/sequences/api";
import { spanRange } from "@/lib/sequences/alternates";
import {
  blockFitPayload,
  nestedSelectedStep,
  numericInsertIndex,
  paletteBlockReason,
  paletteTransitionQuery,
  paletteTransitionReason,
  type FitPayload,
} from "@/lib/sequences/drag";
import { canWrapSpan, stepSpan } from "@/lib/sequences/span";
import type {
  SequenceKind,
  SequenceRecord,
  SequenceStep,
  WorkspaceSelection,
} from "@/lib/sequences/types";
import { listTracks, type ApiTrack } from "@/lib/tracks/api";
import { listTransitions } from "@/lib/transitions/api";
import type { ApiTransition } from "@/lib/transitions/types";
import { displayVocab, qualityRankTone } from "@/lib/transitions/vocab-labels";

import { MixHeadline } from "./mix-headline";

export type PaletteTab = "tracks" | "transitions" | "blocks";

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
  sequenceId,
  sequenceKind,
  selection,
  steps,
  nestedSteps = [],
  tab,
  onTab,
  onAddTrack,
  onAddTransition,
  onAddBlock,
  onClearSelection,
  onDragStart,
  onDragEnd,
}: {
  sequenceId: string;
  sequenceKind: SequenceKind;
  selection: WorkspaceSelection;
  steps: SequenceStep[];
  nestedSteps?: SequenceStep[];
  tab: PaletteTab;
  onTab: (tab: PaletteTab) => void;
  onAddTrack: (track: ApiTrack) => void;
  onAddTransition: (transition: ApiTransition) => void;
  onAddBlock: (block: SequenceRecord) => void;
  onClearSelection: () => void;
  onDragStart: (payload: FitPayload) => void;
  onDragEnd: () => void;
}) {
  const [query, setQuery] = useState("");
  const [newTrackOpen, setNewTrackOpen] = useState(false);
  const [trackEpoch, setTrackEpoch] = useState(0);
  const trackFilters = useMemo(() => ({ query, trackEpoch }), [query, trackEpoch]);
  const wrapSpan = canWrapSpan(sequenceKind) && selection.kind === "span";
  const wrapRange =
    wrapSpan && selection.kind === "span"
      ? stepSpan(steps, selection.fromStepId, selection.toStepId)
      : null;
  const { fromTrackId, toTrackId } = paletteTransitionQuery(
    selection,
    steps,
    nestedSteps,
    wrapSpan,
  );
  const transitionFilters = useMemo(
    () => ({ query, fromTrackId, toTrackId }),
    [query, fromTrackId, toTrackId],
  );
  const blockFilters = useMemo(() => ({ query }), [query]);

  const fetchTracks = useCallback(async (next: { query: string }) => {
    const result = await listTracks({ query: next.query, limit: 50 });
    return { items: result.tracks, hasMore: Boolean(result.hasMore) };
  }, []);
  const noun = sequenceKind === "block" ? "block" : "set";
  const newTrackDisabled = selection.kind === "span";
  const newTrackReason = newTrackDisabled ? "Select a step or gap to insert a track" : null;

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

  const fetchBlocks = useCallback(async (next: { query: string }) => {
    const result = await listSequences({
      kind: "block",
      query: next.query,
      limit: 50,
    });
    return { items: result.sequences, hasMore: result.hasMore };
  }, []);

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
  const blocks = useFilteredList({
    filters: blockFilters,
    fetchPage: fetchBlocks,
    resource: "blocks",
  });

  const gapIndex =
    selection.kind === "gap" ? steps.findIndex((step) => step.id === selection.stepId) : -1;
  const fromStep = gapIndex > 0 ? steps[gapIndex - 1] : null;
  const toStep = gapIndex > 0 ? steps[gapIndex] : null;
  const insertAt = numericInsertIndex(selection, steps);
  const nestedAnchor = nestedSelectedStep(selection, steps, nestedSteps);
  const anchor = nestedAnchor ?? (insertAt > 0 ? steps[insertAt - 1] : null);
  const span =
    wrapSpan || selection.kind !== "span"
      ? null
      : spanRange(steps, selection.fromStepId, selection.toStepId);
  const wrapStart = wrapRange ? steps[wrapRange.fromIdx] : null;
  const wrapEnd = wrapRange ? steps[wrapRange.toIdx] : null;
  const wrapCount = wrapRange ? wrapRange.toIdx - wrapRange.fromIdx + 1 : 0;
  const gapSelected = Boolean(fromStep && toStep);
  const spanSelected = Boolean(span);
  const hasContext =
    gapSelected || spanSelected || Boolean(wrapRange) || (tab === "transitions" && Boolean(anchor));
  const contextLabel = wrapRange
    ? `${wrapCount} ${wrapCount === 1 ? "track" : "tracks"} selected · ${wrapStart?.track?.title ?? "Track"} → ${wrapEnd?.track?.title ?? "Track"}`
    : span && spanSelected
      ? `Fits the selected span · ${span.predecessor.track?.title ?? "Track"} → ${span.destination.track?.title ?? "Track"}`
      : gapSelected
        ? `${fromStep?.track?.title ?? "Track"} → ${toStep?.track?.title ?? "Track"}`
        : anchor
          ? `Out of ${anchor.track?.title ?? "Track"}`
          : "";

  const items = tab === "tracks" ? tracks : tab === "transitions" ? transitions : blocks;
  const emptyText =
    tab === "transitions" && (gapSelected || spanSelected)
      ? "No transition for this pair yet."
      : tab === "transitions" && anchor
        ? `Nothing out of ${anchor.track?.title ?? "this track"} yet.`
        : tab === "blocks"
          ? "No blocks yet."
          : query.trim()
            ? "Nothing matches that search."
            : "No tracks in the library yet.";
  const searchPlaceholder =
    tab === "tracks"
      ? "Search tracks"
      : tab === "transitions"
        ? "Search transitions"
        : "Search blocks";

  const visibleBlocks = (blocks.items as SequenceRecord[]).filter((row) => row.id !== sequenceId);

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
          <SegmentedTab type="button" active={tab === "blocks"} onClick={() => onTab("blocks")}>
            Blocks
          </SegmentedTab>
        </SegmentedTabs>
      </div>
      <div className="border-border border-b px-3.5 py-2.5">
        <FilterField htmlFor="palette-q" label="Search">
          <SearchField
            id="palette-q"
            placeholder={searchPlaceholder}
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
        ) : tab === "blocks" && visibleBlocks.length === 0 ? (
          <p className="text-caption px-3.5 py-6">{emptyText}</p>
        ) : items.items.length === 0 ? (
          <p className="text-caption px-3.5 py-6">{emptyText}</p>
        ) : tab === "tracks" ? (
          (tracks.items as ApiTrack[]).map((track) => {
            const payload: FitPayload = { kind: "track", id: track.id, title: track.title };
            const trackDisabled = selection.kind === "span";
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
                disabled={trackDisabled}
                disabledReason={trackDisabled ? "Select a step or gap to insert a track" : null}
                onAdd={() => onAddTrack(track)}
                onDragStart={(event) => {
                  startPaletteDrag(event, payload);
                  onDragStart(payload);
                }}
                onDragEnd={onDragEnd}
              />
            );
          })
        ) : tab === "transitions" ? (
          (transitions.items as ApiTransition[]).map((transition) => {
            const payload = transitionPayload(transition);
            const reason = paletteTransitionReason(
              payload,
              selection,
              steps,
              nestedSteps,
              wrapSpan,
            );
            const tone = qualityRankTone(transition.quality);
            return (
              <PaletteRow
                key={transition.id}
                icon=""
                iconClass={
                  tone === "success"
                    ? "bg-success-subtle text-success"
                    : tone === "warning"
                      ? "bg-warning-subtle text-warning"
                      : "bg-tertiary text-tertiary-foreground"
                }
                title={<MixHeadline transition={transition} />}
                sub={`${transition.fromTrack.title} → ${transition.toTrack.title}`}
                meta={displayVocab(transition.quality) ?? ""}
                disabled={Boolean(reason)}
                disabledReason={reason}
                onAdd={() => onAddTransition(transition)}
                onDragStart={(event) => {
                  startPaletteDrag(event, payload);
                  onDragStart(payload);
                }}
                onDragEnd={onDragEnd}
              />
            );
          })
        ) : (
          visibleBlocks.map((block) => {
            const payload = blockFitPayload(block);
            const reason = paletteBlockReason(payload, selection, steps, wrapSpan);
            const startTitle = block.startTrack?.title ?? "—";
            const endTitle = block.endTrack?.title ?? "—";
            return (
              <PaletteRow
                key={block.id}
                icon="▸"
                iconClass="bg-brand-subtle text-brand"
                title={block.title}
                sub={`${startTitle} → ${endTitle}`}
                meta={`${block.stepCount} ${block.stepCount === 1 ? "track" : "tracks"}`}
                disabled={Boolean(reason)}
                disabledReason={reason}
                onAdd={() => onAddBlock(block)}
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
      {spanSelected && span && !wrapSpan ? (
        <p className="text-caption border-border border-t px-3.5 py-2">
          + uses this as the alternate for {span.predecessor.track?.title ?? "Track"} →{" "}
          {span.destination.track?.title ?? "Track"}.
        </p>
      ) : null}
      {tab === "tracks" ? (
        <div className="border-border border-t px-3.5 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={newTrackDisabled}
            title={newTrackReason ?? undefined}
            onClick={() => setNewTrackOpen(true)}
          >
            <PlusIcon />
            New track
          </Button>
        </div>
      ) : null}
      <AddTrackDialog
        open={newTrackOpen}
        onOpenChange={setNewTrackOpen}
        initialQuery={query}
        description={`Search the catalog or enter it manually. Saved to your library and inserted into this ${noun}.`}
        onCreated={(track) => {
          setNewTrackOpen(false);
          setTrackEpoch((current) => current + 1);
          onAddTrack(track);
        }}
      />
    </aside>
  );
}

function PaletteRow({
  icon,
  iconClass,
  title,
  sub,
  meta,
  disabled,
  disabledReason,
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  icon: string;
  iconClass?: string;
  title: ReactNode;
  sub: string;
  meta: string;
  disabled: boolean;
  disabledReason?: string | null;
  onAdd: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable={!disabled}
      title={disabledReason ?? undefined}
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
        {typeof title === "string" ? (
          <span className="truncate text-sm font-medium">{title}</span>
        ) : (
          title
        )}
        <span className="text-caption truncate">{sub}</span>
      </span>
      <span className="text-crate-meta">{meta}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Add"
        title={disabledReason ?? undefined}
        disabled={disabled}
        onClick={onAdd}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
