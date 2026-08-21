import Link from "next/link";
import type { Ref } from "react";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { GraphArtwork } from "@/components/graph/artwork";
import { COPY_PHASE_CLASS, type CopyPhase } from "@/components/graph/copy-phase";
import { artistLine } from "@/lib/format";
import type { ApiNeighborhoodCurrent } from "@/lib/graph/types";

export function NowPlayingPanel({
  current,
  copyPhase,
  artHidden,
  swapping,
  canGoBack,
  outboundCount,
  onBack,
  panelRef,
}: {
  current: ApiNeighborhoodCurrent;
  copyPhase: CopyPhase;
  artHidden: boolean;
  swapping: boolean;
  canGoBack: boolean;
  outboundCount: number;
  onBack: () => void;
  panelRef: Ref<HTMLElement>;
}) {
  return (
    <div className="relative">
      <div
        className={cn(
          "from-viz-connector-from via-viz-connector-via pointer-events-none absolute top-28 -right-5 bottom-28 hidden w-10 bg-gradient-to-r to-transparent lg:block",
          "duration-slow transition-opacity",
          swapping ? "opacity-0" : "opacity-100",
        )}
        aria-hidden
      />
      <section
        ref={panelRef}
        aria-labelledby="graph-current-heading"
        className="border-border bg-background sticky top-20 flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
      >
        <div key={current.id} className="flex flex-col gap-4">
          <GraphArtwork
            url={current.artworkUrl}
            variant="hero"
            priority
            className={cn("mx-auto sm:mx-0", artHidden && "opacity-0")}
          />
          <div
            data-hero-text
            className={cn(
              "space-y-1 transition-opacity",
              COPY_PHASE_CLASS[copyPhase],
              copyPhase !== "visible" && "pointer-events-none",
            )}
          >
            <p className="text-eyebrow">Now playing</p>
            <h2
              id="graph-current-heading"
              data-hero-title
              className="text-card-title text-xl font-semibold tracking-tight"
            >
              {current.title}
            </h2>
            <p data-hero-artist className="text-muted-foreground text-sm">
              {artistLine(current.artists)}
            </p>
          </div>
          <div
            className={cn(
              "flex flex-col gap-3 transition-opacity",
              COPY_PHASE_CLASS[copyPhase],
              copyPhase !== "visible" && "pointer-events-none",
            )}
          >
            <dl className="text-muted-foreground grid grid-cols-3 gap-3 text-xs">
              <div>
                <dt className="text-eyebrow">BPM</dt>
                <dd className="text-numeric text-foreground mt-0.5 text-sm">
                  {current.bpm ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-eyebrow">Key</dt>
                <dd className="text-numeric text-foreground mt-0.5 text-sm">
                  {current.musicalKey ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-eyebrow">Outbound</dt>
                <dd className="text-numeric mt-0.5 text-sm font-semibold text-brand">
                  {outboundCount}
                </dd>
              </div>
            </dl>
            <div className="flex items-center justify-between gap-3">
              {canGoBack ? (
                <button
                  type="button"
                  disabled={swapping}
                  onClick={onBack}
                  className={cn(
                    "text-muted-foreground text-sm underline-offset-4",
                    "hover:text-brand hover:underline",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  ← Previous
                </button>
              ) : (
                <span aria-hidden />
              )}
              <Button asChild variant="outline" size="sm" className="w-fit">
                <Link href={`/tracks/${current.id}`}>Track detail</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
