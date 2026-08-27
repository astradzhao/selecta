"use client";

import type { DragEvent, ReactNode } from "react";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import type { FitPayload } from "@/lib/sequences/drag";
import { dropFit } from "@/lib/sequences/drag";
import { unitDisplayIndex, unitRange } from "@/lib/sequences/reorder";
import type {
  DropTarget,
  SequenceDetail,
  SequenceRecord,
  SequenceStep,
  WorkspaceSelection,
} from "@/lib/sequences/types";
import type { ApiTransition } from "@/lib/transitions/types";

import { SequenceGap } from "./sequence-gap";
import { SequenceStepCard } from "./sequence-step-card";

function sameTarget(a: DropTarget | null, b: DropTarget): boolean {
  return a != null && a.kind === b.kind && a.index === b.index;
}

export function SequenceRunningOrder({
  sequenceId,
  kindNounEmpty,
  steps,
  selection,
  pickerStepId,
  notesOpenFor,
  noteValue,
  dragPayload,
  dropTarget,
  draggingStepId,
  expandedBlockIds,
  childById,
  childErrorById,
  onSelectGap,
  onSelectStep,
  onTogglePicker,
  onPickTransition,
  onPickBlock,
  onUnlink,
  onToggleSeam,
  onToggleExpand,
  onEditBlock,
  onDetach,
  onMove,
  onToggleNote,
  onNoteChange,
  onNoteCommit,
  onRemove,
  onStepDragStart,
  onPaletteDrop,
  onReorderDrop,
  onDragEnd,
  onSetDropTarget,
  onAddTrackCta,
  onInsertBlockCta,
}: {
  sequenceId: string;
  kindNounEmpty: string;
  steps: SequenceStep[];
  selection: WorkspaceSelection;
  pickerStepId: string | null;
  notesOpenFor: (step: SequenceStep) => boolean;
  noteValue: (step: SequenceStep) => string;
  dragPayload: FitPayload | null;
  dropTarget: DropTarget | null;
  draggingStepId: string | null;
  expandedBlockIds: Record<string, boolean>;
  childById: Record<string, SequenceDetail>;
  childErrorById: Record<string, string>;
  onSelectGap: (stepId: string) => void;
  onSelectStep: (stepId: string) => void;
  onTogglePicker: (stepId: string) => void;
  onPickTransition: (stepId: string, transition: ApiTransition) => void;
  onPickBlock: (stepId: string, block: SequenceRecord) => void;
  onUnlink: (stepId: string) => void;
  onToggleSeam: (step: SequenceStep) => void;
  onToggleExpand: (blockId: string) => void;
  onEditBlock: (step: SequenceStep) => void;
  onDetach: (step: SequenceStep) => void;
  onMove: (stepId: string, delta: -1 | 1) => void;
  onToggleNote: (stepId: string) => void;
  onNoteChange: (stepId: string, value: string) => void;
  onNoteCommit: (stepId: string) => void;
  onRemove: (step: SequenceStep) => void;
  onStepDragStart: (event: DragEvent, step: SequenceStep) => void;
  onPaletteDrop: (target: DropTarget) => void;
  onReorderDrop: (targetStepId: string) => void;
  onDragEnd: () => void;
  onSetDropTarget: (target: DropTarget | null) => void;
  onAddTrackCta: () => void;
  onInsertBlockCta: () => void;
}) {
  const endTarget: DropTarget = { kind: "end", index: steps.length };
  const endArmed = Boolean(dragPayload && dropFit(dragPayload, endTarget, steps));
  const endOver = sameTarget(dropTarget, endTarget);
  const dragIndex = draggingStepId ? steps.findIndex((step) => step.id === draggingStepId) : -1;
  const [dragStart, dragEnd] =
    dragIndex >= 0 ? unitRange(steps, dragIndex) : ([-1, -1] as [number, number]);

  function armOver(event: DragEvent, target: DropTarget, allowed: boolean) {
    if (!allowed) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = dragPayload ? "copy" : "move";
    if (!sameTarget(dropTarget, target)) onSetDropTarget(target);
  }

  function renderCard(
    step: SequenceStep,
    index: number,
    unitStart: number,
    unitEnd: number,
    options: { showIndex?: boolean; movable?: boolean } = {},
  ) {
    const showIndex = options.showIndex ?? true;
    const movable = options.movable ?? true;
    const stepTarget: DropTarget = { kind: "step", index: unitEnd + 1 };
    const stepArmed = Boolean(
      dragPayload
        ? dropFit(dragPayload, stepTarget, steps)
        : draggingStepId && draggingStepId !== step.id,
    );
    return (
      <SequenceStepCard
        step={step}
        index={index}
        selected={selection.kind === "step" && selection.stepId === step.id}
        notesOpen={notesOpenFor(step)}
        noteValue={noteValue(step)}
        dragging={movable && dragStart >= 0 && unitStart >= dragStart && unitEnd <= dragEnd}
        dropArmed={Boolean(dragPayload) && stepArmed}
        dropOver={sameTarget(dropTarget, stepTarget)}
        canMoveUp={unitStart > 0}
        canMoveDown={unitEnd < steps.length - 1}
        showIndex={showIndex}
        movable={movable}
        onSelect={() => onSelectStep(step.id)}
        onMove={(delta) => onMove(step.id, delta)}
        onToggleNote={() => onToggleNote(step.id)}
        onNoteChange={(value) => onNoteChange(step.id, value)}
        onNoteCommit={() => onNoteCommit(step.id)}
        onRemove={() => onRemove(step)}
        onDragStart={(event) => onStepDragStart(event, step)}
        onDragOver={(event) => {
          if (dragPayload) {
            armOver(event, stepTarget, stepArmed);
            return;
          }
          if (draggingStepId && draggingStepId !== step.id) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (dragPayload) onPaletteDrop(stepTarget);
          else onReorderDrop(step.id);
        }}
        onDragEnd={onDragEnd}
      />
    );
  }

  function renderGap(step: SequenceStep, previous: SequenceStep, index: number) {
    const gapTarget: DropTarget = { kind: "gap", index };
    const gapArmed = Boolean(dragPayload && dropFit(dragPayload, gapTarget, steps));
    const blockId = step.inBlockId;
    return (
      <SequenceGap
        step={step}
        previous={previous}
        selected={selection.kind === "gap" && selection.stepId === step.id}
        pickerOpen={pickerStepId === step.id}
        dropArmed={gapArmed}
        dropOver={sameTarget(dropTarget, gapTarget)}
        sequenceId={sequenceId}
        expanded={Boolean(blockId && expandedBlockIds[blockId])}
        child={blockId ? (childById[blockId] ?? null) : null}
        childError={blockId ? (childErrorById[blockId] ?? null) : null}
        selection={selection}
        notesOpenFor={notesOpenFor}
        noteValue={noteValue}
        onSelect={() => onSelectGap(step.id)}
        onTogglePicker={() => onTogglePicker(step.id)}
        onPickTransition={(transition) => onPickTransition(step.id, transition)}
        onPickBlock={(block) => onPickBlock(step.id, block)}
        onUnlink={() => onUnlink(step.id)}
        onToggleSeam={() => onToggleSeam(step)}
        onToggleExpand={() => {
          if (blockId) onToggleExpand(blockId);
        }}
        onEditBlock={() => onEditBlock(step)}
        onDetach={() => onDetach(step)}
        onSelectStep={onSelectStep}
        onToggleNote={onToggleNote}
        onNoteChange={onNoteChange}
        onNoteCommit={onNoteCommit}
        onDragOver={(event) => {
          if (dragPayload) {
            armOver(event, gapTarget, gapArmed);
            return;
          }
          if (draggingStepId && draggingStepId !== step.id) {
            event.preventDefault();
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (dragPayload) onPaletteDrop(gapTarget);
          else onReorderDrop(step.id);
        }}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      {steps.map((step, index) => {
        const [unitStart, unitEnd] = unitRange(steps, index);
        if (unitStart < index) return null;
        const previous = index > 0 ? steps[index - 1]! : null;
        const isUnit = unitEnd > unitStart;
        const host = isUnit ? steps[unitEnd]! : null;
        const displayIndex = unitDisplayIndex(steps, index);
        const innerCount =
          (host?.inBlockId ? childById[host.inBlockId]?.steps.length : null) ??
          host?.inBlock?.stepCount ??
          2;
        const unitDragging = dragStart >= 0 && unitStart >= dragStart && unitEnd <= dragEnd;
        return (
          <div key={step.id}>
            {previous ? renderGap(step, previous, index) : null}
            {isUnit && host ? (
              <UnitShell
                displayIndex={displayIndex}
                anchor={step}
                host={host}
                innerCount={innerCount}
                dragging={unitDragging}
                canMoveUp={unitStart > 0}
                canMoveDown={unitEnd < steps.length - 1}
                onMove={(delta) => onMove(host.id, delta)}
                onRemove={() => onRemove(host)}
                onDragStart={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (target?.closest("button, input, a, textarea")) {
                    event.preventDefault();
                    return;
                  }
                  onStepDragStart(event, host);
                }}
                onDragOver={(event) => {
                  const stepTarget: DropTarget = { kind: "step", index: unitEnd + 1 };
                  const stepArmed = Boolean(
                    dragPayload
                      ? dropFit(dragPayload, stepTarget, steps)
                      : draggingStepId && draggingStepId !== host.id,
                  );
                  if (dragPayload) {
                    armOver(event, stepTarget, stepArmed);
                    return;
                  }
                  if (draggingStepId && draggingStepId !== host.id) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const stepTarget: DropTarget = { kind: "step", index: unitEnd + 1 };
                  if (dragPayload) onPaletteDrop(stepTarget);
                  else onReorderDrop(host.id);
                }}
                onDragEnd={onDragEnd}
              >
                {renderCard(step, 0, unitStart, unitEnd, { movable: false })}
                {renderGap(host, step, unitEnd)}
                {renderCard(host, Math.max(1, innerCount) - 1, unitStart, unitEnd, {
                  movable: false,
                })}
              </UnitShell>
            ) : (
              renderCard(step, displayIndex, unitStart, unitEnd)
            )}
          </div>
        );
      })}

      {steps.length === 0 ? (
        <div className="border-border flex flex-col items-center rounded-2xl border border-dashed px-5 py-10 text-center">
          <p className="font-medium">{kindNounEmpty}</p>
        </div>
      ) : null}

      {endArmed ? (
        <div
          onDragOver={(event) => armOver(event, endTarget, true)}
          onDrop={(event) => {
            event.preventDefault();
            if (dragPayload) onPaletteDrop(endTarget);
          }}
          className={cn(
            "mt-2 ml-[34px] rounded-xl border border-dashed px-3.5 py-3.5",
            endOver ? "border-selected bg-brand-subtle" : "border-ring",
          )}
        />
      ) : null}

      <div className="flex gap-2 pt-4 pl-[34px]">
        <Button type="button" variant="secondary" size="sm" onClick={onAddTrackCta}>
          + Add track
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onInsertBlockCta}>
          + Insert block
        </Button>
      </div>
    </div>
  );
}

function UnitShell({
  displayIndex,
  anchor,
  host,
  innerCount,
  dragging,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  children,
}: {
  displayIndex: number;
  anchor: SequenceStep;
  host: SequenceStep;
  innerCount: number;
  dragging: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onDragStart: (event: DragEvent) => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onDragEnd: () => void;
  children: ReactNode;
}) {
  const title = host.inBlock?.title?.trim() || "Block";
  const incomplete = host.inBlock?.isComplete === false;
  const fromTitle = anchor.track?.title ?? "Track";
  const toTitle = host.track?.title ?? "Track";
  const count = innerCount;
  const subtitle = `${count} ${count === 1 ? "track" : "tracks"} · ${fromTitle} → ${toTitle}`;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-xl border py-1",
        incomplete ? "border-warning" : "border-brand",
        dragging && "opacity-45",
      )}
    >
      <div className="grid grid-cols-[24px_28px_minmax(0,1fr)_auto] items-center gap-3 px-2.5 py-1.5">
        <span
          title="Drag to reorder"
          className="text-muted-foreground cursor-grab select-none text-center text-sm leading-none"
        >
          ⠿
        </span>
        <span className="text-crate-meta text-right">
          {String(displayIndex + 1).padStart(2, "0")}
        </span>
        <span className="flex min-w-0 flex-col gap-px">
          <span className={cn("truncate font-medium", incomplete && "text-warning")}>{title}</span>
          <span className="text-caption truncate">
            {subtitle}
            {incomplete ? " · open joins inside" : ""}
          </span>
        </span>
        <span className="flex items-center gap-px">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Move up"
            disabled={!canMoveUp}
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
            disabled={!canMoveDown}
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
            title="Remove unit"
            className="text-destructive hover:bg-destructive-subtle"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            <span aria-hidden>✕</span>
          </Button>
        </span>
      </div>
      {children}
    </div>
  );
}
