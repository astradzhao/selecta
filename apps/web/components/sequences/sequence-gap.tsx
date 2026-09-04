"use client";

import type { DragEvent } from "react";
import Link from "next/link";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { spanRange } from "@/lib/sequences/alternates";
import { displayGapState, gapChrome, gapRowLabel } from "@/lib/sequences/gap-display";
import { bpmDelta } from "@/lib/sequences/metrics";
import type {
  SequenceAlternate,
  SequenceDetail,
  SequenceRecord,
  SequenceStep,
  WorkspaceSelection,
} from "@/lib/sequences/types";
import { addTransitionHref } from "@/lib/sequences/view";
import type { ApiTransition } from "@/lib/transitions/types";

import { BlockConnectorRow } from "./block-connector-row";
import { ConnectorPicker } from "./connector-picker";
import { AlternateList } from "./alternate-list";

export function SequenceGap({
  step,
  previous,
  selected,
  pickerOpen,
  dropArmed,
  dropOver,
  sequenceId,
  expanded,
  child,
  childError,
  selection,
  notesOpenFor,
  noteValue,
  steps,
  onSelect,
  onTogglePicker,
  onPickTransition,
  onPickBlock,
  onUnlink,
  onToggleSeam,
  onToggleExpand,
  onEditBlock,
  onDetach,
  onAddAlternate,
  onSelectStep,
  onToggleNote,
  onNoteChange,
  onNoteCommit,
  onDragOver,
  onDrop,
  alternates,
  showGhost,
  ghostFromTrackId,
  ghostToTrackId,
  expandedAlternateIds,
  childById,
  childErrorById,
  onToggleAlternateExpand,
  onRemoveAlternate,
  onCommitAlternateLabel,
}: {
  step: SequenceStep;
  previous: SequenceStep;
  selected: boolean;
  pickerOpen: boolean;
  dropArmed: boolean;
  dropOver: boolean;
  sequenceId: string;
  expanded: boolean;
  child: SequenceDetail | null;
  childError: string | null;
  selection: WorkspaceSelection;
  notesOpenFor: (step: SequenceStep) => boolean;
  noteValue: (step: SequenceStep) => string;
  steps: SequenceStep[];
  childById: Record<string, SequenceDetail>;
  childErrorById: Record<string, string>;
  onSelect: () => void;
  onTogglePicker: () => void;
  onPickTransition: (transition: ApiTransition) => void;
  onPickBlock: (block: SequenceRecord) => void;
  onUnlink: () => void;
  onToggleSeam: () => void;
  onToggleExpand: () => void;
  onEditBlock: () => void;
  onDetach: () => void;
  onAddAlternate: () => void;
  onSelectStep: (stepId: string, shiftKey?: boolean) => void;
  onToggleNote: (stepId: string) => void;
  onNoteChange: (stepId: string, value: string) => void;
  onNoteCommit: (stepId: string) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  alternates: SequenceAlternate[];
  showGhost: boolean;
  ghostFromTrackId: string | null;
  ghostToTrackId: string | null;
  expandedAlternateIds: Record<string, boolean>;
  onToggleAlternateExpand: (item: SequenceAlternate) => void;
  onRemoveAlternate: (item: SequenceAlternate) => void;
  onCommitAlternateLabel: (item: SequenceAlternate, label: string) => void;
}) {
  const state = displayGapState(step);
  if (!state) return null;
  const chrome = gapChrome(state);
  const fromTitle = previous.track?.title ?? "Track";
  const toTitle = step.track?.title ?? "Track";
  const blockState =
    state === "block" || state === "block-incomplete" || state === "block-broken" ? state : null;
  const span =
    selection.kind === "span" ? spanRange(steps, selection.fromStepId, selection.toStepId) : null;
  const pickerFromTrackId = span?.predecessor.trackId ?? previous.trackId;
  const pickerToTrackId = span?.destination.trackId ?? step.trackId;
  const pickerFromTitle = span?.predecessor.track?.title ?? fromTitle;
  const pickerToTitle = span?.destination.track?.title ?? toTitle;

  return (
    <div
      className={cn(
        "ml-[34px] flex flex-col gap-1.5 border-l-2 py-1.5 pr-3 pl-4",
        chrome.railClass,
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {blockState ? (
        <BlockConnectorRow
          state={blockState}
          step={step}
          previous={previous}
          selected={selected}
          dropArmed={dropArmed}
          dropOver={dropOver}
          expanded={expanded}
          child={child}
          childError={childError}
          selection={selection}
          notesOpenFor={notesOpenFor}
          noteValue={noteValue}
          onSelect={onSelect}
          onToggleExpand={onToggleExpand}
          onEdit={onEditBlock}
          onDetach={onDetach}
          onUnlink={onUnlink}
          onToggleSeam={onToggleSeam}
          onAddAlternate={onAddAlternate}
          onSelectStep={onSelectStep}
          onToggleNote={onToggleNote}
          onNoteChange={onNoteChange}
          onNoteCommit={onNoteCommit}
        />
      ) : (
        <TransitionGapRow
          step={step}
          previous={previous}
          state={state}
          chrome={chrome}
          selected={selected}
          pickerOpen={pickerOpen}
          dropArmed={dropArmed}
          dropOver={dropOver}
          onSelect={onSelect}
          onTogglePicker={onTogglePicker}
          onUnlink={onUnlink}
          onToggleSeam={onToggleSeam}
          onAddAlternate={onAddAlternate}
        />
      )}
      {pickerOpen ? (
        <ConnectorPicker
          fromTrackId={pickerFromTrackId}
          toTrackId={pickerToTrackId}
          fromTitle={pickerFromTitle}
          toTitle={pickerToTitle}
          excludeSequenceId={sequenceId}
          onPickTransition={onPickTransition}
          onPickBlock={onPickBlock}
        />
      ) : null}
      <AlternateList
        items={alternates}
        steps={steps}
        showGhost={showGhost}
        ghostFromTrackId={ghostFromTrackId}
        ghostToTrackId={ghostToTrackId}
        expandedIds={expandedAlternateIds}
        childById={childById}
        childErrorById={childErrorById}
        onToggleExpand={onToggleAlternateExpand}
        onRemove={onRemoveAlternate}
        onCommitLabel={onCommitAlternateLabel}
      />
    </div>
  );
}

function TransitionGapRow({
  step,
  previous,
  state,
  chrome,
  selected,
  pickerOpen,
  dropArmed,
  dropOver,
  onSelect,
  onTogglePicker,
  onUnlink,
  onToggleSeam,
  onAddAlternate,
}: {
  step: SequenceStep;
  previous: SequenceStep;
  state: NonNullable<ReturnType<typeof displayGapState>>;
  chrome: ReturnType<typeof gapChrome>;
  selected: boolean;
  pickerOpen: boolean;
  dropArmed: boolean;
  dropOver: boolean;
  onSelect: () => void;
  onTogglePicker: () => void;
  onUnlink: () => void;
  onToggleSeam: () => void;
  onAddAlternate: () => void;
}) {
  const fromTitle = previous.track?.title ?? "Track";
  const toTitle = step.track?.title ?? "Track";
  const label = gapRowLabel(state, step, fromTitle, toTitle);
  const delta = bpmDelta(previous.track?.bpm, step.track?.bpm);

  return (
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
        {state === "linked" ? (
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
        <Button
          type="button"
          variant="ghost"
          size="xs"
          title="Add alternate"
          onClick={(event) => {
            event.stopPropagation();
            onAddAlternate();
          }}
        >
          + alt
        </Button>
      </span>
    </div>
  );
}
