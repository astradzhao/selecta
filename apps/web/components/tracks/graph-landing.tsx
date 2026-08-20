"use client";

import { useState } from "react";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { TrackPickerDialog } from "@/components/tracks/track-picker";
import { motionDelay } from "@/lib/motion";
import type { ApiTrack } from "@/lib/tracks/api";

export function GraphLanding({ onStart }: { onStart: (trackId: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function startWithTrack(track: ApiTrack) {
    setLeaving(true);
    setPickerOpen(false);
    window.setTimeout(() => {
      onStart(track.id);
    }, motionDelay(220));
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center py-16 text-center",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 duration-500",
          leaving &&
            "pointer-events-none opacity-0 transition-all duration-300 motion-safe:-translate-y-2",
        )}
      >
        <div className="border-border/80 bg-surface-1 mb-8 flex size-20 items-center justify-center rounded-full border">
          <div className="border-foreground/25 relative size-10">
            <span className="bg-foreground absolute top-1/2 left-0 h-px w-full -translate-y-1/2" />
            <span className="bg-foreground absolute top-0 left-1/2 h-full w-px -translate-x-1/2" />
            <span className="border-foreground absolute top-1/2 left-0 size-2.5 -translate-y-1/2 rounded-full border-2 bg-background" />
            <span className="border-foreground absolute top-0 left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 bg-background" />
            <span className="border-foreground absolute right-0 bottom-0 size-2.5 rounded-full border-2 bg-background" />
          </div>
        </div>
        <p className="text-eyebrow">Graph explorer</p>
        <h1 className="text-page-title mt-3 max-w-md text-balance">
          Choose a track to get started
        </h1>
        <p className="text-body text-muted-foreground mt-3 max-w-md">
          Pick a song from your library, then browse outbound transitions and walk the mix graph hop
          by hop.
        </p>
        <Button type="button" size="lg" className="mt-8" onClick={() => setPickerOpen(true)}>
          Choose a track
        </Button>
      </div>

      <TrackPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={startWithTrack} />
    </>
  );
}
