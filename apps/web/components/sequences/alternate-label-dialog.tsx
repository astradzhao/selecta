"use client";

import { useState } from "react";

import { Button } from "@selecta/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@selecta/ui/components/dialog";
import { Input } from "@selecta/ui/components/input";

import { FormField } from "@/components/common/form-field";
import type { AlternateDraft } from "@/lib/sequences/types";

function draftKey(draft: AlternateDraft) {
  return `${draft.fromStepId}:${draft.toStepId}:${draft.altTransitionId ?? ""}:${draft.altBlockId ?? ""}`;
}

export function AlternateLabelDialog({
  draft,
  pending,
  error,
  onOpenChange,
  onConfirm,
}: {
  draft: AlternateDraft | null;
  pending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (label: string) => void;
}) {
  return (
    <Dialog open={draft != null} onOpenChange={onOpenChange}>
      <DialogContent>
        {draft ? (
          <AlternateLabelForm
            key={draftKey(draft)}
            draft={draft}
            pending={pending}
            error={error}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AlternateLabelForm({
  draft,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  draft: AlternateDraft;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (label: string) => void;
}) {
  const [label, setLabel] = useState("");
  const disabled = label.trim().length === 0 || pending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const next = label.trim();
        if (!next || pending) return;
        onConfirm(next);
      }}
    >
      <DialogHeader>
        <DialogTitle>Add alternate</DialogTitle>
        <DialogDescription>
          A plan B for this span: {draft.summary}. The primary line stays as it is.
        </DialogDescription>
      </DialogHeader>
      <div className="py-2">
        <FormField id="alternate-label" label="When" error={error}>
          <Input
            value={label}
            autoFocus
            placeholder="if the room is hot"
            onChange={(event) => setLabel(event.target.value)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {pending ? "Adding…" : "Add alternate"}
        </Button>
      </DialogFooter>
    </form>
  );
}
