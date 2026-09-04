"use client";

import { useMemo, useState } from "react";

import { Button } from "@selecta/ui/components/button";
import { Checkbox } from "@selecta/ui/components/checkbox";
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
import { alternateDesc, spanRange } from "@/lib/sequences/alternates";
import type { SequenceAlternate, SequenceStep } from "@/lib/sequences/types";
import { idsConflictingWithSelection } from "@/lib/sequences/versions";

export type VersionDraft = {
  versionId: string | null;
  name: string;
  alternateIds: string[];
};

export function VersionDialog({
  draft,
  steps,
  alternates,
  pending,
  error,
  onOpenChange,
  onConfirm,
}: {
  draft: VersionDraft | null;
  steps: SequenceStep[];
  alternates: SequenceAlternate[];
  pending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (draft: VersionDraft) => void;
}) {
  return (
    <Dialog open={draft != null} onOpenChange={onOpenChange}>
      <DialogContent>
        {draft ? (
          <VersionForm
            key={`${draft.versionId ?? "new"}:${draft.name}:${draft.alternateIds.join(",")}`}
            draft={draft}
            steps={steps}
            alternates={alternates}
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

function VersionForm({
  draft,
  steps,
  alternates,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  draft: VersionDraft;
  steps: SequenceStep[];
  alternates: SequenceAlternate[];
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (draft: VersionDraft) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [selectedIds, setSelectedIds] = useState(() => new Set(draft.alternateIds));
  const mapped = useMemo(() => alternates.filter((item) => item.valid), [alternates]);
  const conflicts = idsConflictingWithSelection(steps, mapped, selectedIds);
  const disabled = name.trim().length === 0 || pending;
  const creating = draft.versionId == null;

  return (
    <form
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        const next = name.trim();
        if (!next || pending) return;
        onConfirm({
          versionId: draft.versionId,
          name: next,
          alternateIds: [...selectedIds],
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>{creating ? "Save version" : "Edit version"}</DialogTitle>
        <DialogDescription>
          A named selection of alternates. The running order itself does not copy.
        </DialogDescription>
      </DialogHeader>
      <div className="flex min-w-0 flex-col gap-3 py-2">
        <FormField id="version-name" label="Name" error={error}>
          <Input
            value={name}
            autoFocus
            placeholder="if the room is hot"
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="text-caption text-muted-foreground">Alternates</legend>
          {mapped.length === 0 ? (
            <p className="text-caption text-muted-foreground">No mapped alternates yet.</p>
          ) : (
            mapped.map((item) => {
              const range = spanRange(steps, item.fromStepId, item.toStepId);
              const fromTitle = range?.predecessor.track?.title ?? "Track";
              const toTitle = range?.destination.track?.title ?? "Track";
              const covers =
                range && range.fromIdx < range.toIdx
                  ? `covers ${range.toIdx - range.fromIdx + 1} steps · ${fromTitle} → ${toTitle}`
                  : alternateDesc(item, fromTitle, toTitle);
              const checked = selectedIds.has(item.id);
              const blocked = !checked && conflicts.has(item.id);
              return (
                <label
                  key={item.id}
                  className="flex min-w-0 items-start gap-2 rounded-lg border border-border px-2.5 py-2"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    disabled={blocked || pending}
                    onChange={(event) => {
                      const next = new Set(selectedIds);
                      if (event.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      setSelectedIds(next);
                    }}
                  />
                  <span className="min-w-0">
                    <span className="text-body block truncate">
                      {item.label?.trim() || "untitled"}
                    </span>
                    {covers ? (
                      <span className="text-caption text-muted-foreground block truncate">
                        {covers}
                        {blocked ? " · overlaps a chosen span" : null}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })
          )}
        </fieldset>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {pending ? "Saving…" : creating ? "Save version" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
