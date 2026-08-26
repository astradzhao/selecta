"use client";

import type { DragEvent } from "react";
import Link from "next/link";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { bpmDelta, mixLabel } from "@/lib/sequences/metrics";
import { availableGapLabel, displayGapState, gapChrome } from "@/lib/sequences/gap-display";
import type { SequenceStep } from "@/lib/sequences/types";
import { addTransitionHref } from "@/lib/sequences/view";
import { displayVocab } from "@/lib/transitions/vocab-labels";
import type { ApiTransition } from "@/lib/transitions/types";

import { TransitionPicker } from "./transition-picker";

export function SequenceGap({
  step,
  previous,
  selected,
  pickerOpen,
  dropArmed,
  dropOver,
  onSelect,
  onTogglePicker,
  onPick,
  onUnlink,
  onToggleSeam,
  onDragOver,
  onDrop,
}: {
  step: SequenceStep;
  previous: SequenceStep;
  selected: boolean;
  pickerOpen: boolean;
  dropArmed: boolean;
  dropOver: boolean;
  onSelect: () => void;
  onTogglePicker: () => void;
  onPick: (transition: ApiTransition) => void;
  onUnlink: () => void;
  onToggleSeam: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}) {
  const state = displayGapState(step);
  if (!state) return null;
  const chrome = gapChrome(state);
  const fromTitle = previous.track?.title ?? "Track";
  const toTitle = step.track?.title ?? "Track";
  const transition = step.inTransition;
  const technique = displayVocab(transition?.technique) ?? "mix";
  const linkedLabel =
    transition &&
    mixLabel({
      technique,
      barsOverlap: transition.barsOverlap,
      quality: displayVocab(transition.quality),
    });
  const delta = bpmDelta(previous.track?.bpm, step.track?.bpm);

  let label = linkedLabel ?? "";
  if (state === "available") label = availableGapLabel(step.transitionCandidateCount);
  if (state === "unmapped") label = "no transition for this pair yet";
  if (state === "seam") label = "open seam · improvise";
  if (state === "block") label = "Block connector";

  return (
    <div
      className={cn("ml-[34px] flex flex-col gap-1.5 border-l-2 py-1.5 pl-4", chrome.railClass)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5",
          chrome.rowClass,
          dropOver
            ? "border-selected bg-brand-subtle"
            : dropArmed
              ? "border-ring"
              : selected
                ? "border-ring"
                : null,
        )}
      >
        <span className={cn("min-w-0 truncate text-sm font-medium", chrome.inkClass)}>
          {chrome.icon} {label}
        </span>
        {state === "linked" && delta ? (
          <span className="bg-surface-2 text-crate-meta shrink-0 rounded-full px-1.5 py-px">
            {delta} BPM
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {state === "available" || state === "linked" ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-brand"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePicker();
              }}
            >
              {pickerOpen ? "Close" : state === "linked" ? "Swap" : "Pick"}
            </Button>
          ) : null}
          {state === "unmapped" ? (
            <Button asChild variant="link" size="xs">
              <Link
                href={addTransitionHref(previous.trackId, step.trackId)}
                onClick={(event) => event.stopPropagation()}
              >
                Add transition
              </Link>
            </Button>
          ) : null}
          {state === "linked" || state === "block" ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={(event) => {
                event.stopPropagation();
                onUnlink();
              }}
            >
              Unlink
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            title={state === "seam" ? "Unmark seam" : "Mark as a seam"}
            className={state === "seam" ? "text-brand" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSeam();
            }}
          >
            〜
          </Button>
        </span>
      </div>
      {pickerOpen ? (
        <TransitionPicker
          fromTrackId={previous.trackId}
          toTrackId={step.trackId}
          fromTitle={fromTitle}
          toTitle={toTitle}
          onPick={onPick}
        />
      ) : null}
    </div>
  );
}
