"use client";

import { useId, useState, type DragEvent, type MouseEvent } from "react";

import { Button } from "@selecta/ui/components/button";
import { Badge } from "@selecta/ui/components/badge";
import { Select } from "@selecta/ui/components/select";
import { cn } from "@selecta/ui/lib/utils";

import {
  canInspectMix,
  displayGapState,
  gapChrome,
  gapRowLabel,
} from "@/lib/sequences/gap-display";
import { bpmDelta } from "@/lib/sequences/metrics";
import type { SequenceDetail, SequenceStep, WorkspaceSelection } from "@/lib/sequences/types";
import { BASE_VERSION_VALUE, resolveVersionPath } from "@/lib/sequences/versions";

import { MixInspector } from "./mix-inspector";
import { SequenceStepCard } from "./sequence-step-card";

function ignoreDrag(event: DragEvent) {
  event.stopPropagation();
}

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
  selection,
  notesOpenFor,
  noteValue,
  onSelect,
  onToggleExpand,
  onEdit,
  onDetach,
  onUnlink,
  onToggleSeam,
  onAddAlternate,
  onPickBlockVersion,
  pathLocked,
  alternateChip,
  onSelectStep,
  onToggleNote,
  onNoteChange,
  onNoteCommit,
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
  selection: WorkspaceSelection;
  notesOpenFor: (step: SequenceStep) => boolean;
  noteValue: (step: SequenceStep) => string;
  onSelect: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDetach: () => void;
  onUnlink: () => void;
  onToggleSeam: () => void;
  onAddAlternate?: () => void;
  onPickBlockVersion?: (versionId: string | null) => void;
  pathLocked?: boolean;
  alternateChip?: string | null;
  onSelectStep: (stepId: string, shiftKey?: boolean) => void;
  onToggleNote: (stepId: string) => void;
  onNoteChange: (stepId: string, value: string) => void;
  onNoteCommit: (stepId: string) => void;
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
        {alternateChip ? <Badge variant="brand">{alternateChip}</Badge> : null}
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {onPickBlockVersion && step.inBlock && step.inBlock.versions.length > 0 ? (
            <Select
              aria-label="Block version"
              className="w-auto min-w-28"
              value={step.inBlockVersionId ?? BASE_VERSION_VALUE}
              onClick={stop}
              onChange={(event) => {
                const value = event.target.value;
                onPickBlockVersion(value === BASE_VERSION_VALUE ? null : value);
              }}
            >
              <option value={BASE_VERSION_VALUE}>Base</option>
              {step.inBlock.versions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          ) : null}
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
          {!pathLocked ? (
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
          ) : null}
          {!pathLocked ? (
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
          ) : null}
          {!broken && !pathLocked ? (
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
          {onAddAlternate ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              title="Add alternate"
              onClick={(event) => {
                stop(event);
                onAddAlternate();
              }}
            >
              + alt
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
              <BlockInteriorSequence
                child={child}
                childError={childError}
                versionId={step.inBlockVersionId}
                selection={selection}
                notesOpenFor={notesOpenFor}
                noteValue={noteValue}
                onSelectStep={onSelectStep}
                onToggleNote={onToggleNote}
                onNoteChange={onNoteChange}
                onNoteCommit={onNoteCommit}
              />
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
  versionId,
  selection,
  notesOpenFor,
  noteValue,
  onSelectStep,
  onToggleNote,
  onNoteChange,
  onNoteCommit,
}: {
  child: SequenceDetail | null;
  childError: string | null;
  versionId: string | null;
  selection: WorkspaceSelection;
  notesOpenFor: (step: SequenceStep) => boolean;
  noteValue: (step: SequenceStep) => string;
  onSelectStep: (stepId: string, shiftKey?: boolean) => void;
  onToggleNote: (stepId: string) => void;
  onNoteChange: (stepId: string, value: string) => void;
  onNoteCommit: (stepId: string) => void;
}) {
  if (childError) {
    return <p className="text-caption text-destructive">{childError}</p>;
  }
  if (!child) {
    return <p className="text-caption">Loading…</p>;
  }
  const chosen = child.versions.find((item) => item.id === versionId)?.alternateIds ?? [];
  const resolved = resolveVersionPath(child.steps, child.alternates, chosen);
  return (
    <div>
      {resolved.steps.map((inner, index) => {
        const prev = index > 0 ? resolved.steps[index - 1]! : null;
        const isEndpoint = index === 0 || index === resolved.steps.length - 1;
        return (
          <div key={inner.id}>
            {prev ? <InteriorGap step={inner} previous={prev} /> : null}
            {isEndpoint ? null : (
              <div onDragOver={ignoreDrag} onDrop={ignoreDrag}>
                <SequenceStepCard
                  step={inner}
                  index={index}
                  selected={selection.kind === "step" && selection.stepId === inner.id}
                  notesOpen={notesOpenFor(inner)}
                  noteValue={noteValue(inner)}
                  dragging={false}
                  dropArmed={false}
                  dropOver={false}
                  canMoveUp={false}
                  canMoveDown={false}
                  movable={false}
                  onSelect={(event) => onSelectStep(inner.id, event.shiftKey)}
                  onToggleNote={() => onToggleNote(inner.id)}
                  onNoteChange={(value) => onNoteChange(inner.id, value)}
                  onNoteCommit={() => onNoteCommit(inner.id)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InteriorGap({ step, previous }: { step: SequenceStep; previous: SequenceStep }) {
  const [open, setOpen] = useState(false);
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
  const inspectable = canInspectMix(state, step.inTransition);
  const inspectOpen = inspectable && open;

  function toggle() {
    if (!inspectable) return;
    setOpen((current) => !current);
  }

  return (
    <div
      className={cn("mr-2.5 ml-[20px] flex flex-col border-l-2 py-1 pr-10 pl-3", chrome.railClass)}
    >
      <div
        role={inspectable ? "button" : undefined}
        tabIndex={inspectable ? 0 : undefined}
        aria-expanded={inspectable ? inspectOpen : undefined}
        onClick={inspectable ? toggle : undefined}
        onKeyDown={
          inspectable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle();
                }
              }
            : undefined
        }
        className={cn(
          "flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5",
          chrome.rowClass,
          inspectable && "cursor-pointer",
          inspectOpen && "border-ring",
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
      {inspectable && step.inTransition ? (
        <MixInspector open={inspectOpen} transition={step.inTransition} />
      ) : null}
    </div>
  );
}
