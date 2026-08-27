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
import { useToast } from "@selecta/ui/components/toast";

import { FormField } from "@/components/common/form-field";
import { describeApiError } from "@/lib/api/errors";
import { graphTrailToSequenceSeed, type GraphTrailHop } from "@/lib/graph/session-store";
import { createSequence } from "@/lib/sequences/api";

export function SaveTrailDialog({
  open,
  onOpenChange,
  trail,
  activeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trail: GraphTrailHop[];
  activeId: string;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const createDisabled = title.trim().length === 0 || saving;

  async function handleCreate() {
    const nextTitle = title.trim();
    if (!nextTitle || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const result = await createSequence({
        kind: "block",
        title: nextTitle,
        seed: { trail: graphTrailToSequenceSeed(trail, activeId) },
      });
      toast(`Saved “${result.sequence.title}” as a block. Find it under Blocks.`);
      setTitle("");
      onOpenChange(false);
    } catch (err) {
      setFormError(describeApiError(err, { resource: "block" }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setTitle("");
          setFormError(null);
        }
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <DialogHeader>
            <DialogTitle>Save trail as a block</DialogTitle>
            <DialogDescription>
              A reusable run you can drop into any set as one connector. Your trail stays open.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <FormField id="save-trail-title" label="Title" error={formError}>
              <Input
                value={title}
                autoFocus
                placeholder="Warm-up run"
                onChange={(event) => setTitle(event.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDisabled}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
