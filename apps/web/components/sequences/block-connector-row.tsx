"use client";

import { useId, type MouseEvent } from "react";
import Image from "next/image";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { artistLine, formatDuration } from "@/lib/format";
import { displayGapState, gapChrome, gapRowLabel } from "@/lib/sequences/gap-display";
import { bpmDelta } from "@/lib/sequences/metrics";
import type { SequenceDetail, SequenceStep } from "@/lib/sequences/types";

export function BlockConnectorRow({
  state,
  step,
  previous,
  selected,
  dropArmed,
  dropOver,
  expanded,
  child,
  childError,
  onSelect,
  onToggleExpand,
  onEdit,
  onDetach,
  onUnlink,
  onToggleSeam,
}: {
  state: "block" | "block-incomplete" | "block-broken";
  step: SequenceStep;
  previous: SequenceStep;
  selected: boolean;
  dropArmed: boolean;
  dropOver: boolean;
  expanded: boolean;
  child: SequenceDetail | null;
  childError: string | null;
  onSelect: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDetach: () => void;
  onUnlink: () => void;
  onToggleSeam: () => void;
}) {
  const panelId = useId();
  const fromTitle = previous.track?.title ?? "Track";
  const toTitle = step.track?.title ?? "Track";
  const broken = state === "block-broken";
  const incomplete = state === "block-incomplete";
  const label = gapRowLabel(state, step, fromTitle, toTitle);
  const warning = incomplete ? "open joins inside" : null;
  const delta = broken ? null : bpmDelta(previous.track?.bpm, step.track?.bpm);
  const icon = broken ? "⚠" : "▸";
  const inkClass = broken ? "text-destructive" : incomplete ? "text-warning" : "text-brand";
  const rowClass = broken
    ? "border-destructive-subtle bg-destructive-subtle"
    : incomplete
      ? "border-warning-subtle bg-warning-subtle"
      : "border-brand bg-brand-subtle";

  function activate() {
    onSelect();
    if (!broken) onToggleExpand();
  }

  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={broken ? undefined : expanded}
        aria-controls={broken ? undefined : panelId}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }}
        className={cn(
          "flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5",
          !broken && "cursor-pointer",
          rowClass,
          dropOver
            ? "border-selected bg-brand-subtle"
            : dropArmed
              ? "border-ring"
              : selected
                ? "border-ring"
                : null,
        )}
      >
        <span className={cn("min-w-0 truncate text-sm font-medium", inkClass)}>
          {icon} {label}
          {warning ? ` · ${warning}` : ""}
        </span>
        {delta ? (
          <span className="bg-surface-2 text-crate-meta shrink-0 rounded-full px-1.5 py-px">
            {delta} BPM
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {!broken ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={(event) => {
                stop(event);
                onEdit();
              }}
            >
              Edit block
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={(event) => {
              stop(event);
              onDetach();
            }}
          >
            Detach
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={(event) => {
              stop(event);
              onUnlink();
            }}
          >
            Unlink
          </Button>
          {!broken ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              title={step.isSeam ? "Unmark seam" : "Mark as a seam"}
              className={step.isSeam ? "text-brand" : undefined}
              onClick={(event) => {
                stop(event);
                onToggleSeam();
              }}
            >
              〜
            </Button>
          ) : null}
        </span>
      </div>
      {!broken ? (
        <div
          id={panelId}
          inert={!expanded}
          className={cn(
            "ease-out-soft duration-slow grid transition-[grid-template-rows]",
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div
              className={cn(
                "duration-slow ease-out-soft pt-1.5 transition-opacity",
                expanded ? "opacity-100" : "opacity-0",
              )}
              onClick={stop}
            >
              <BlockInteriorSequence child={child} childError={childError} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BlockInteriorSequence({
  child,
  childError,
}: {
  child: SequenceDetail | null;
  childError: string | null;
}) {
  if (childError) {
    return <p className="text-caption text-destructive">{childError}</p>;
  }
  if (!child) {
    return <p className="text-caption">Loading…</p>;
  }
  return (
    <div>
      {child.steps.map((inner, index) => {
        const prev = index > 0 ? child.steps[index - 1]! : null;
        const isEndpoint = index === 0 || index === child.steps.length - 1;
        return (
          <div key={inner.id}>
            {prev ? <InteriorGap step={inner} previous={prev} /> : null}
            {isEndpoint ? null : <InteriorTrack step={inner} index={index} />}
          </div>
        );
      })}
    </div>
  );
}

function InteriorTrack({ step, index }: { step: SequenceStep; index: number }) {
  const title = step.track?.title ?? "Unknown track";
  const artists = step.track ? artistLine(step.track.artists) : "Unknown artist";
  const duration = formatDuration(step.track?.durationSec ?? null) ?? "—";
  const bpm =
    step.track?.bpm != null && Number.isFinite(step.track.bpm)
      ? String(Math.round(step.track.bpm))
      : "—";
  const key = step.track?.musicalKey?.trim() || "—";
  const initial = title.slice(0, 1).toUpperCase();

  return (
    <div className="grid grid-cols-[20px_28px_minmax(0,1fr)_86px_2.75rem_1.75rem] items-center gap-2.5 py-1 pr-2.5">
      <span className="text-crate-meta text-right">{String(index + 1).padStart(2, "0")}</span>
      <span className="bg-surface-3 text-muted-foreground relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-semibold">
        {step.track?.artworkUrl ? (
          <Image src={step.track.artworkUrl} alt="" fill className="object-cover" sizes="28px" />
        ) : (
          initial
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="text-caption truncate">{artists}</span>
      </span>
      <span className="text-crate-meta text-right">
        {bpm} · {key}
      </span>
      <span className="text-crate-meta text-right">{duration}</span>
      <span />
    </div>
  );
}

function InteriorGap({ step, previous }: { step: SequenceStep; previous: SequenceStep }) {
  const state = displayGapState(step);
  if (!state) return null;
  const chrome = gapChrome(state);
  const fromTitle = previous.track?.title ?? "Track";
  const toTitle = step.track?.title ?? "Track";
  const label = gapRowLabel(state, step, fromTitle, toTitle);
  const delta =
    state === "linked" || state === "block" || state === "block-incomplete"
      ? bpmDelta(previous.track?.bpm, step.track?.bpm)
      : null;

  return (
    <div
      className={cn("mr-2.5 ml-[20px] flex flex-col border-l-2 py-1 pr-10 pl-3", chrome.railClass)}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5",
          chrome.rowClass,
        )}
      >
        <span className={cn("min-w-0 truncate text-sm font-medium", chrome.inkClass)}>
          {chrome.icon} {label}
          {state === "block-incomplete" ? " · open joins inside" : ""}
        </span>
        {delta ? (
          <span className="bg-surface-2 text-crate-meta ml-auto shrink-0 rounded-full px-1.5 py-px">
            {delta} BPM
          </span>
        ) : null}
      </div>
    </div>
  );
}
