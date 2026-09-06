import Link from "next/link";

import { Button } from "@selecta/ui/components/button";
import { EmptyState } from "@selecta/ui/components/empty-state";

import { AddTransitionPanel } from "@/components/graph/add-transition-panel";
import { GraphArtwork } from "@/components/graph/artwork";
import { NeighborCard } from "@/components/graph/neighbor-card";
import { GraphSetPinBadges } from "@/components/sequences/graph-set-rail";
import { artistLine } from "@/lib/format";
import type { GraphSetPin } from "@/lib/graph/set-mode";
import type { ApiNeighborhoodNeighbor } from "@/lib/graph/types";
import { libraryAddHref } from "@/lib/library/add-routes";

export function NextTransitions({
  currentId,
  neighbors,
  pins = [],
  seamMarker = null,
  expandedKey,
  adding,
  swapping,
  choosingId,
  baseId,
  onExit,
  onToggleAdd,
  onCreated,
  registerRef,
  onToggle,
  onPrefetch,
  onChoose,
  onNeighborhoodChange,
}: {
  currentId: string;
  neighbors: ApiNeighborhoodNeighbor[];
  pins?: GraphSetPin[];
  seamMarker?: { nextTitle: string } | null;
  expandedKey: string | null;
  adding: boolean;
  swapping: boolean;
  choosingId: string | null;
  baseId: string;
  onExit: () => void;
  onToggleAdd: () => void;
  onCreated: () => Promise<void>;
  registerRef: (rowKey: string, element: HTMLElement | null) => void;
  onToggle: (rowKey: string, expanded: boolean) => void;
  onPrefetch: (neighborId: string) => void;
  onChoose: (neighborId: string, transitionId: string | null) => void;
  onNeighborhoodChange: () => Promise<void>;
}) {
  const pinnedIds = new Set(pins.map((pin) => pin.trackId));
  const rest = neighbors.filter((neighbor) => !pinnedIds.has(neighbor.id));
  const destinationCount = neighbors.length;
  const transitionCount = neighbors.reduce((sum, neighbor) => sum + neighbor.transitions.length, 0);
  const showEmpty = neighbors.length === 0 && pins.length === 0 && !seamMarker;

  return (
    <section aria-labelledby="graph-next-heading" className="min-w-0 space-y-3">
      <div className="motion-safe:animate-in motion-safe:fade-in-0 duration-slow flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 id="graph-next-heading" className="text-sm font-medium tracking-tight">
            Next transitions
          </h2>
          <span className="text-caption">
            {destinationCount === 1 ? `1 destination` : `${destinationCount} destinations`}
            {transitionCount !== destinationCount ? ` · ${transitionCount} transitions` : null}
          </span>
        </div>
        <Button
          type="button"
          variant={adding ? "outline" : "default"}
          size="sm"
          disabled={swapping}
          onClick={onToggleAdd}
        >
          {adding ? "Cancel add" : "Add transition"}
        </Button>
      </div>

      {adding ? (
        <AddTransitionPanel
          fromTrackId={currentId}
          excludeTrackId={currentId}
          onCancel={onToggleAdd}
          onCreated={onCreated}
        />
      ) : null}

      {seamMarker ? (
        <div className="bg-surface-1 rounded-2xl border border-border px-4 py-3">
          <p className="text-caption">
            〜 Improvise — next planned track is {seamMarker.nextTitle}
          </p>
        </div>
      ) : null}

      {showEmpty ? (
        <EmptyState
          className="bg-surface-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 duration-slow items-center rounded-2xl border border-dashed text-center"
          title="No outbound transitions yet"
          description="Add a transition to a library track, or capture a mix note that links this song onward."
        >
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button type="button" size="sm" onClick={onToggleAdd}>
              Add transition
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={libraryAddHref("tracks")}>Add a track</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onExit}>
              Choose another track
            </Button>
          </div>
        </EmptyState>
      ) : (
        <ul key={currentId} className="space-y-2">
          {pins.map((pin, index) => {
            const neighbor = neighbors.find((item) => item.id === pin.trackId);
            if (!neighbor) {
              return <MissingPin key={pin.trackId} pin={pin} />;
            }
            const rowKey = neighbor.id;
            const expanded = expandedKey === rowKey;
            return (
              <NeighborCard
                key={rowKey}
                neighbor={neighbor}
                expanded={expanded}
                index={index}
                panelId={`${baseId}-${rowKey}`}
                registerRef={(element) => registerRef(rowKey, element)}
                onToggle={() => onToggle(rowKey, expanded)}
                onPrefetch={() => onPrefetch(neighbor.id)}
                onChoose={(transitionId) => onChoose(neighbor.id, transitionId)}
                onNeighborhoodChange={onNeighborhoodChange}
                fadingOut={swapping && choosingId !== neighbor.id}
                choosing={choosingId === neighbor.id}
                preferredTransitionId={pin.plannedTransitionId}
                badges={<GraphSetPinBadges onScript={pin.onScript} alternates={pin.alternates} />}
              />
            );
          })}
          {rest.map((neighbor, index) => {
            const rowKey = neighbor.id;
            const expanded = expandedKey === rowKey;
            return (
              <NeighborCard
                key={rowKey}
                neighbor={neighbor}
                expanded={expanded}
                index={pins.length + index}
                panelId={`${baseId}-${rowKey}`}
                registerRef={(element) => registerRef(rowKey, element)}
                onToggle={() => onToggle(rowKey, expanded)}
                onPrefetch={() => onPrefetch(neighbor.id)}
                onChoose={(transitionId) => onChoose(neighbor.id, transitionId)}
                onNeighborhoodChange={onNeighborhoodChange}
                fadingOut={swapping && choosingId !== neighbor.id}
                choosing={choosingId === neighbor.id}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MissingPin({ pin }: { pin: GraphSetPin }) {
  return (
    <li className="border-border bg-background overflow-hidden rounded-2xl border">
      <div className="flex w-full items-start gap-3 px-4 py-3.5">
        <GraphArtwork url={pin.artworkUrl} variant="card" sizes="220px" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-card-title truncate">{pin.title}</p>
              <p className="text-muted-foreground truncate text-sm">{artistLine(pin.artists)}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <GraphSetPinBadges onScript={pin.onScript} alternates={pin.alternates} />
            </div>
          </div>
          <p className="text-caption">No transition yet</p>
          {pin.addHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pin.addHref}>Add transition</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
