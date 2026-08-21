"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { cn } from "@selecta/ui/lib/utils";

import { GraphArtwork } from "@/components/graph/artwork";
import { edgeKey, formatGraphLabel } from "@/components/graph/helpers";
import { NeighborDetail } from "@/components/graph/neighbor-detail";
import { artistLine } from "@/lib/format";
import type { ApiNeighborhoodNeighbor } from "@/lib/graph/types";
import { qualityBadgeTone } from "@/lib/graph/viz";

export function NeighborCard({
  neighbor,
  expanded,
  onToggle,
  onChoose,
  onPrefetch,
  onNeighborhoodChange,
  fadingOut,
  choosing,
  index,
  panelId,
  registerRef,
}: {
  neighbor: ApiNeighborhoodNeighbor;
  expanded: boolean;
  onToggle: () => void;
  onChoose: () => void;
  onPrefetch: () => void;
  onNeighborhoodChange: () => Promise<void>;
  fadingOut: boolean;
  choosing: boolean;
  index: number;
  panelId: string;
  registerRef: (element: HTMLElement | null) => void;
}) {
  const edges = neighbor.transitions;
  const defaultEdge = edges[0];
  const [selectedKey, setSelectedKey] = useState(() =>
    defaultEdge ? edgeKey(defaultEdge, neighbor.id) : neighbor.id,
  );
  const selected =
    edges.find((edge) => edgeKey(edge, neighbor.id) === selectedKey) ?? defaultEdge ?? null;
  const technique = selected ? formatGraphLabel(selected.technique) : null;
  const intent = selected ? formatGraphLabel(selected.intent) : null;

  return (
    <li
      className={cn(
        "border-border bg-background overflow-hidden rounded-2xl border",
        "ease-standard duration-hop transition-[opacity,transform]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 fill-mode-both",
        fadingOut && "pointer-events-none opacity-0 motion-safe:translate-x-6",
        choosing && "pointer-events-none opacity-0",
        expanded ? "border-brand/30" : "hover:border-brand/25",
      )}
      style={{
        animationDelay: `${Math.min(index, 8) * 30}ms`,
        transitionDelay: fadingOut ? `${Math.min(index, 6) * 22}ms` : undefined,
      }}
    >
      <button
        ref={registerRef}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        onPointerEnter={onPrefetch}
        onFocus={onPrefetch}
        className={cn(
          "bg-background flex w-full items-start gap-3 px-4 py-3.5 text-left",
          "hover:bg-surface-2 focus-visible:ring-ring duration-base transition-colors focus-visible:ring-3 focus-visible:outline-none",
          expanded && "bg-surface-1",
        )}
      >
        <GraphArtwork url={neighbor.artworkUrl} variant="card" sizes="220px" />
        <div data-card-text className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-card-title truncate">{neighbor.title}</p>
              <p className="text-muted-foreground truncate text-sm">
                {artistLine(neighbor.artists)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {edges.length > 1 ? (
                <Badge variant="outline" className="text-numeric text-caption">
                  {edges.length}
                </Badge>
              ) : null}
              {selected?.quality ? (
                <Badge variant={qualityBadgeTone(selected.quality)}>
                  {formatGraphLabel(selected.quality)}
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="text-caption text-numeric line-clamp-1">
            {selected
              ? [
                  selected.fromBar != null || selected.toBar != null
                    ? `Bars ${selected.fromBar ?? "—"} → ${selected.toBar ?? "—"}`
                    : null,
                  technique,
                  intent,
                  edges.length > 1 ? `${edges.length} transitions` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Transition details"
              : "No transitions"}
          </p>
        </div>
        <ChevronRightIcon
          className={cn(
            "text-muted-foreground mt-1 size-4 shrink-0 duration-base transition-transform",
            expanded && "rotate-90",
          )}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        inert={!expanded}
        className={cn(
          "ease-out-soft duration-slow grid transition-[grid-template-rows]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "duration-base transition-opacity",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
            <NeighborDetail
              neighbor={neighbor}
              selected={selected}
              selectedKey={selectedKey}
              onSelectKey={setSelectedKey}
              onChoose={onChoose}
              onNeighborhoodChange={onNeighborhoodChange}
              choosing={choosing}
            />
          </div>
        </div>
      </div>
    </li>
  );
}
