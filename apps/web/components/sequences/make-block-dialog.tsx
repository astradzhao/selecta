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

export function MakeBlockDialog({
  open,
  pending,
  error,
  fromTitle,
  toTitle,
  trackCount,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  fromTitle: string;
  toTitle: string;
  trackCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (title: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <MakeBlockForm
            pending={pending}
            error={error}
            fromTitle={fromTitle}
            toTitle={toTitle}
            trackCount={trackCount}
            onCancel={() => onOpenChange(false)}
            onConfirm={onConfirm}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MakeBlockForm({
  pending,
  error,
  fromTitle,
  toTitle,
  trackCount,
  onCancel,
  onConfirm,
}: {
  pending: boolean;
  error: string | null;
  fromTitle: string;
  toTitle: string;
  trackCount: number;
  onCancel: () => void;
  onConfirm: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const createDisabled = title.trim().length === 0 || pending;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const nextTitle = title.trim();
        if (!nextTitle || pending) return;
        onConfirm(nextTitle);
      }}
    >
      <DialogHeader>
        <DialogTitle>Make block</DialogTitle>
        <DialogDescription>
          A reusable run of {trackCount} {trackCount === 1 ? "track" : "tracks"} ({fromTitle} →{" "}
          {toTitle}). This night will use it as one connector — Detach if you want the tracks loose
          again.
        </DialogDescription>
      </DialogHeader>
      <div className="py-2">
        <FormField id="make-block-title" label="Title" error={error}>
          <Input
            value={title}
            autoFocus
            placeholder="Peak run"
            onChange={(event) => setTitle(event.target.value)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createDisabled}>
          {pending ? "Saving…" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
