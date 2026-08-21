"use client";

import { useState } from "react";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { TrackPickerDialog } from "@/components/tracks/track-picker";
import { DURATION_FAST_MS, motionDelay } from "@/lib/motion";
import type { ApiTrack } from "@/lib/tracks/api";

function GraphLogo() {
  return (
    <svg viewBox="0 0 40 40" className="size-10" aria-hidden="true">
      <line x1="2" y1="20" x2="38" y2="20" className="stroke-border" strokeWidth="1" />
      <line x1="20" y1="2" x2="20" y2="38" className="stroke-border" strokeWidth="1" />
      <circle cx="6" cy="20" r="5" className="fill-background stroke-brand" strokeWidth="2" />
      <circle cx="20" cy="6" r="5" className="fill-background stroke-brand" strokeWidth="2" />
      <circle cx="34" cy="34" r="5" className="fill-background stroke-brand" strokeWidth="2" />
    </svg>
  );
}

export function GraphLanding({ onStart }: { onStart: (trackId: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function startWithTrack(track: ApiTrack) {
    setLeaving(true);
    setPickerOpen(false);
    window.setTimeout(() => {
      onStart(track.id);
    }, motionDelay(DURATION_FAST_MS));
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center py-16 text-center",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 duration-slow",
          leaving &&
            "pointer-events-none opacity-0 transition-all duration-base motion-safe:-translate-y-2",
        )}
      >
        <div className="border-border/80 bg-surface-1 mb-8 flex size-20 items-center justify-center rounded-full border">
          <GraphLogo />
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
