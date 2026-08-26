"use client";

import type { DragEvent } from "react";
import Image from "next/image";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { artistLine, formatDuration } from "@/lib/format";
import type { SequenceStep } from "@/lib/sequences/types";

function stepArtwork(step: SequenceStep) {
  const title = step.track?.title ?? "Track";
  const initial = title.slice(0, 1).toUpperCase();
  return (
    <span className="bg-surface-3 text-muted-foreground relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sm font-semibold">
      {step.track?.artworkUrl ? (
        <Image src={step.track.artworkUrl} alt="" fill className="object-cover" sizes="36px" />
      ) : (
        initial
      )}
    </span>
  );
}

function bpmKey(step: SequenceStep): string {
  const bpm =
    step.track?.bpm != null && Number.isFinite(step.track.bpm)
      ? String(Math.round(step.track.bpm))
      : "—";
  const key = step.track?.musicalKey?.trim() || "—";
  return `${bpm} · ${key}`;
}

export function SequenceStepCard({
  step,
  index,
  total,
  selected,
  notesOpen,
  noteValue,
  dragging,
  dropArmed,
  dropOver,
  dropHint,
  onSelect,
  onMove,
  onToggleNote,
  onNoteChange,
  onNoteCommit,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  step: SequenceStep;
  index: number;
  total: number;
  selected: boolean;
  notesOpen: boolean;
  noteValue: string;
  dragging: boolean;
  dropArmed: boolean;
  dropOver: boolean;
  dropHint: string;
  onSelect: () => void;
  onMove: (delta: -1 | 1) => void;
  onToggleNote: () => void;
  onNoteChange: (value: string) => void;
  onNoteCommit: () => void;
  onRemove: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onDragEnd: () => void;
}) {
  const title = step.track?.title ?? "Unknown track";
  const artists = step.track ? artistLine(step.track.artists) : "Unknown artist";
  const duration = formatDuration(step.track?.durationSec ?? null) ?? "—";
  const noteActive = Boolean(noteValue.trim()) || notesOpen;

  return (
    <div>
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onSelect}
        className={cn(
          "grid grid-cols-[18px_20px_36px_minmax(0,1fr)_auto_auto_auto] items-center gap-2.5 rounded-xl border px-2.5 py-2",
          dropOver
            ? "border-selected bg-brand-subtle"
            : dropArmed
              ? "border-ring"
              : selected
                ? "border-ring bg-surface-1"
                : "border-border bg-card hover:border-ring",
          dragging && "opacity-45",
        )}
      >
        <span
          title="Drag to reorder"
          className="text-muted-foreground cursor-grab select-none text-sm leading-none"
        >
          ⠿
        </span>
        <span className="text-crate-meta text-right">{String(index + 1).padStart(2, "0")}</span>
        {stepArtwork(step)}
        <span className="flex min-w-0 flex-col gap-px">
          <span className="truncate font-medium">{title}</span>
          <span className="text-caption truncate">{artists}</span>
        </span>
        <span className="text-crate-meta w-[86px] text-right">{bpmKey(step)}</span>
        <span className="text-crate-meta w-11 text-right">{duration}</span>
        <span className="flex items-center gap-px">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Move up"
            disabled={index === 0}
            onClick={(event) => {
              event.stopPropagation();
              onMove(-1);
            }}
          >
            <span aria-hidden>↑</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Move down"
            disabled={index === total - 1}
            onClick={(event) => {
              event.stopPropagation();
              onMove(1);
            }}
          >
            <span aria-hidden>↓</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Step note"
            className={noteActive ? "text-brand" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onToggleNote();
            }}
          >
            <span aria-hidden>✎</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Remove step"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <span aria-hidden>✕</span>
          </Button>
        </span>
      </div>
      {dropOver && dropHint ? (
        <span className="text-brand block pt-1 pl-[84px] text-xs font-medium">↳ {dropHint}</span>
      ) : null}
      {notesOpen ? (
        <div className="flex items-center gap-2 pt-1.5 pl-[84px]">
          <span className="text-eyebrow">Note</span>
          <input
            value={noteValue}
            placeholder="kill the bass early"
            className="border-input h-8 flex-1 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onNoteChange(event.target.value)}
            onBlur={() => onNoteCommit()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onNoteCommit();
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
