"use client";

import Link from "next/link";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { StatePanel } from "@selecta/ui/components/state-panel";

import { NextTransitions } from "@/components/graph/next-transitions";
import { NowPlayingPanel } from "@/components/graph/now-playing-panel";
import { useGraphExplorer } from "@/components/graph/use-graph-explorer";

export function GraphExplorer({ onExit }: { onExit: () => void }) {
  const explorer = useGraphExplorer();
  const { trackId, current, error, pending, choosingId, neighbors } = explorer;

  if (!trackId) return null;

  if (pending && !current) {
    return (
      <StatePanel
        variant="loading"
        className="motion-safe:animate-in motion-safe:fade-in-0 duration-base"
      >
        Loading neighborhood…
      </StatePanel>
    );
  }

  if (error || !current) {
    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 duration-slow space-y-4">
        <Alert variant="destructive">{error ?? "Track not found."}</Alert>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={onExit}>
            Back to Graph
          </Button>
          <Button asChild variant="outline">
            <Link href={`/tracks/${trackId}`}>Track detail</Link>
          </Button>
        </div>
      </div>
    );
  }

  const swapping = choosingId !== null;

  return (
    <div className="space-y-4">
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 duration-slow flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm text-pretty">
          Expand a neighbor for mix detail, then choose it to traverse.
        </p>
        <Button type="button" variant="destructive" size="sm" onClick={onExit}>
          Exit
        </Button>
      </div>

      {/* Sticky now-playing column vs next-transitions list; ratios match the old explorer. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.5fr)] lg:gap-6">
        <NowPlayingPanel
          current={current}
          copyPhase={explorer.copyPhase}
          artHidden={explorer.artHidden}
          swapping={swapping}
          canGoBack={explorer.trail.length > 0}
          outboundCount={neighbors.length}
          onBack={explorer.goBackInTrail}
          panelRef={explorer.panelRef}
        />
        <NextTransitions
          currentId={current.id}
          neighbors={neighbors}
          expandedKey={explorer.expandedKey}
          adding={explorer.adding}
          swapping={swapping}
          choosingId={choosingId}
          baseId={explorer.baseId}
          onExit={onExit}
          onToggleAdd={() => explorer.setAdding((value) => !value)}
          onCreated={async () => {
            explorer.setAdding(false);
            await explorer.refreshNeighborhood();
          }}
          registerRef={explorer.registerCardRef}
          onToggle={(rowKey, expanded) => {
            explorer.setExpandedKey(expanded ? null : rowKey);
            if (!expanded) void explorer.loadNeighborhood(rowKey).catch(() => null);
          }}
          onPrefetch={(neighborId) => void explorer.loadNeighborhood(neighborId).catch(() => null)}
          onChoose={(neighborId) =>
            void explorer.goToTrack(neighborId, explorer.cardElement(neighborId))
          }
          onNeighborhoodChange={explorer.refreshNeighborhood}
        />
      </div>
    </div>
  );
}
