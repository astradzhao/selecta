"use client";

import type { DragEvent } from "react";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import type { FitPayload } from "@/lib/sequences/drag";
import { dropFit } from "@/lib/sequences/drag";
import type { DropTarget, SequenceStep, WorkspaceSelection } from "@/lib/sequences/types";
import type { ApiTransition } from "@/lib/transitions/types";

import { SequenceGap } from "./sequence-gap";
import { SequenceStepCard } from "./sequence-step-card";

function sameTarget(a: DropTarget | null, b: DropTarget): boolean {
  return a != null && a.kind === b.kind && a.index === b.index;
}

export function SequenceRunningOrder({
  kindNounEmpty,
  steps,
  selection,
  pickerStepId,
  notesOpenFor,
  noteValue,
  dragPayload,
  dropTarget,
  draggingStepId,
  onSelectGap,
  onSelectStep,
  onTogglePicker,
  onPickTransition,
  onUnlink,
  onToggleSeam,
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
}: {
  kindNounEmpty: string;
  steps: SequenceStep[];
  selection: WorkspaceSelection;
  pickerStepId: string | null;
  notesOpenFor: (step: SequenceStep) => boolean;
  noteValue: (step: SequenceStep) => string;
  dragPayload: FitPayload | null;
  dropTarget: DropTarget | null;
  draggingStepId: string | null;
  onSelectGap: (stepId: string) => void;
  onSelectStep: (stepId: string) => void;
  onTogglePicker: (stepId: string) => void;
  onPickTransition: (stepId: string, transition: ApiTransition) => void;
  onUnlink: (stepId: string) => void;
  onToggleSeam: (step: SequenceStep) => void;
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
}) {
  const endTarget: DropTarget = { kind: "end", index: steps.length };
  const endArmed = Boolean(
    dragPayload && dropFit(dragPayload, endTarget, steps, edgeOf(dragPayload)),
  );
  const endOver = sameTarget(dropTarget, endTarget);

  function armOver(event: DragEvent, target: DropTarget, allowed: boolean) {
    if (!allowed) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = dragPayload ? "copy" : "move";
    if (!sameTarget(dropTarget, target)) onSetDropTarget(target);
  }

  return (
    <div className="flex min-w-0 flex-col">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1]! : null;
        const gapTarget: DropTarget = { kind: "gap", index };
        const stepTarget: DropTarget = { kind: "step", index: index + 1 };
        const gapArmed = Boolean(
          dragPayload && previous && dropFit(dragPayload, gapTarget, steps, edgeOf(dragPayload)),
        );
        const stepArmed = Boolean(
          dragPayload
            ? dropFit(dragPayload, stepTarget, steps, edgeOf(dragPayload))
            : draggingStepId && draggingStepId !== step.id,
        );
        return (
          <div key={step.id}>
            {previous ? (
              <SequenceGap
                step={step}
                previous={previous}
                selected={selection.kind === "gap" && selection.stepId === step.id}
                pickerOpen={pickerStepId === step.id}
                dropArmed={gapArmed}
                dropOver={sameTarget(dropTarget, gapTarget)}
                onSelect={() => onSelectGap(step.id)}
                onTogglePicker={() => onTogglePicker(step.id)}
                onPick={(transition) => onPickTransition(step.id, transition)}
                onUnlink={() => onUnlink(step.id)}
                onToggleSeam={() => onToggleSeam(step)}
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
            ) : null}
            <SequenceStepCard
              step={step}
              index={index}
              total={steps.length}
              selected={selection.kind === "step" && selection.stepId === step.id}
              notesOpen={notesOpenFor(step)}
              noteValue={noteValue(step)}
              dragging={draggingStepId === step.id}
              dropArmed={Boolean(dragPayload) && stepArmed}
              dropOver={sameTarget(dropTarget, stepTarget)}
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
      </div>
    </div>
  );
}

function edgeOf(payload: FitPayload | null) {
  return payload?.kind === "transition" ? payload : null;
}
