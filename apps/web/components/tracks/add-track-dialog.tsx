"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@selecta/ui/components/dialog";

import { AddTrackFlow } from "@/components/tracks/add-track-flow";
import type { ApiTrack } from "@/lib/tracks/api";

export function AddTrackDialog({
  open,
  onOpenChange,
  initialQuery,
  title = "Add a track",
  description = "Search the catalog or enter it manually. It is saved to your library and added to this running order.",
  submitLabel = "Save and add",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
  title?: string;
  description?: string;
  submitLabel?: string;
  onCreated: (track: ApiTrack) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(70vh,36rem)] overflow-y-auto duration-fast sm:max-w-lg">
        <DialogHeader className="gap-1.5 pe-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open ? (
          <AddTrackFlow
            compact
            initialQuery={initialQuery}
            submitLabel={submitLabel}
            onCreated={onCreated}
            onDismiss={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
