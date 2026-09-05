"use client";

import { Button } from "@selecta/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@selecta/ui/components/dialog";

import type { OffScriptPrompt } from "@/components/sequences/use-graph-set-mode";

export function OffScriptDialog({
  prompt,
  error,
  pending,
  canSaveAlternate,
  onSaveAlternate,
  onInsert,
  onReplace,
  onKeepExploring,
  onOpenChange,
}: {
  prompt: OffScriptPrompt | null;
  error: string | null;
  pending: boolean;
  canSaveAlternate: boolean;
  onSaveAlternate: () => void;
  onInsert: () => void;
  onReplace: () => void;
  onKeepExploring: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={prompt != null} onOpenChange={onOpenChange}>
      <DialogContent>
        {prompt ? (
          <>
            <DialogHeader>
              <DialogTitle>Off script</DialogTitle>
              <DialogDescription>
                You went to “{prompt.destinationTitle}” — not in this set at step{" "}
                {prompt.stepNumber}.
              </DialogDescription>
            </DialogHeader>
            {error ? <p className="text-destructive text-caption">{error}</p> : null}
            <DialogFooter className="sm:flex-col sm:items-stretch">
              {canSaveAlternate ? (
                <Button type="button" disabled={pending} onClick={onSaveAlternate}>
                  Save as alternate
                </Button>
              ) : null}
              <Button type="button" variant="outline" disabled={pending} onClick={onInsert}>
                Insert here
              </Button>
              {prompt.plannedTitle ? (
                <Button type="button" variant="outline" disabled={pending} onClick={onReplace}>
                  Replace “{prompt.plannedTitle}”
                </Button>
              ) : null}
              <Button type="button" variant="ghost" disabled={pending} onClick={onKeepExploring}>
                Keep exploring
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
