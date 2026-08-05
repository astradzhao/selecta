"use client";

import { useId, useMemo } from "react";

import { cn } from "@selecta/ui/lib/utils";

import type { ApiNeighborhoodCurrent, ApiNeighborhoodNeighbor } from "@/lib/tracks/api";
import { layoutNeighborhood, neighborhoodEdgePath } from "@/lib/tracks/neighborhood-layout";

const CURRENT_R = 28;
const NEIGHBOR_R = 16;

function artistLine(artists: { name: string }[]): string {
  return artists.map((a) => a.name).join(", ") || "Unknown artist";
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function edgeStroke(quality: string | null): { opacity: number; width: number } {
  if (quality === "great") return { opacity: 0.85, width: 2.25 };
  if (quality === "ok") return { opacity: 0.55, width: 1.75 };
  if (quality === "risky") return { opacity: 0.35, width: 1.5 };
  return { opacity: 0.28, width: 1.5 };
}

/**
 * Reusable one-hop neighborhood visualization (DJ-55).
 * Renders only the current track and its outbound neighbors — never the full library.
 */
export function NeighborhoodGraph({
  current,
  neighbors,
  activeNeighborId = null,
  onActiveNeighborChange,
  onSelectNeighbor,
  disabled = false,
  className,
}: {
  current: Pick<ApiNeighborhoodCurrent, "id" | "title" | "artists">;
  neighbors: Array<
    Pick<ApiNeighborhoodNeighbor, "id" | "title" | "artists"> & {
      transition: Pick<ApiNeighborhoodNeighbor["transition"], "quality">;
    }
  >;
  activeNeighborId?: string | null;
  onActiveNeighborChange?: (id: string | null) => void;
  onSelectNeighbor: (neighborId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const reactId = useId();
  const markerId = `${reactId}-arrow`;
  const titleId = `${reactId}-title`;

  const layout = useMemo(() => layoutNeighborhood(neighbors.map((n) => n.id)), [neighbors]);
  const neighborById = useMemo(() => new Map(neighbors.map((n) => [n.id, n])), [neighbors]);

  if (neighbors.length === 0) {
    return (
      <div
        className={cn(
          "border-border bg-muted/15 text-muted-foreground flex h-[140px] items-center justify-center rounded-2xl border border-dashed text-sm",
          className,
        )}
      >
        No outbound connections to draw
      </div>
    );
  }

  return (
    <div
      className={cn("border-border bg-background overflow-hidden rounded-2xl border", className)}
    >
      <svg
        role="group"
        aria-labelledby={titleId}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="text-foreground h-[min(36vw,220px)] w-full"
      >
        <title id={titleId}>
          Neighborhood of {current.title}: {neighbors.length} outbound transition
          {neighbors.length === 1 ? "" : "s"}
        </title>

        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 Z" className="fill-foreground/50" />
          </marker>
        </defs>

        <line
          x1={layout.current.x + CURRENT_R + 8}
          y1={layout.current.y}
          x2={layout.width * 0.66}
          y2={layout.current.y}
          className="stroke-foreground/8"
          strokeWidth={1}
          strokeDasharray="3 6"
        />

        {layout.neighbors.map((point) => {
          const neighbor = neighborById.get(point.id);
          if (!neighbor) return null;
          const stroke = edgeStroke(neighbor.transition.quality);
          const active = activeNeighborId === neighbor.id;
          return (
            <path
              key={`edge-${neighbor.id}`}
              d={neighborhoodEdgePath(layout.current, point, CURRENT_R, NEIGHBOR_R)}
              fill="none"
              className="stroke-foreground transition-[stroke-opacity] duration-200"
              strokeOpacity={active ? Math.min(1, stroke.opacity + 0.25) : stroke.opacity}
              strokeWidth={active ? stroke.width + 0.5 : stroke.width}
              markerEnd={`url(#${markerId})`}
            />
          );
        })}

        <g transform={`translate(${layout.current.x} ${layout.current.y})`}>
          <circle
            r={CURRENT_R + 6}
            className="fill-foreground/5 stroke-foreground/20"
            strokeWidth={1}
          />
          <circle r={CURRENT_R} className="fill-foreground stroke-background" strokeWidth={3} />
          <text
            textAnchor="middle"
            y={CURRENT_R + 18}
            className="fill-foreground text-[11px] font-medium"
          >
            {truncate(current.title, 22)}
          </text>
          <text
            textAnchor="middle"
            y={CURRENT_R + 32}
            className="fill-muted-foreground text-[10px]"
          >
            now
          </text>
        </g>

        {layout.neighbors.map((point) => {
          const neighbor = neighborById.get(point.id);
          if (!neighbor) return null;
          const active = activeNeighborId === neighbor.id;
          return (
            <g key={neighbor.id} transform={`translate(${point.x} ${point.y})`}>
              <circle
                r={NEIGHBOR_R + (active ? 5 : 3)}
                className={cn(
                  "fill-transparent stroke-foreground/15 transition-[stroke] duration-200",
                  active && "stroke-foreground/45",
                )}
                strokeWidth={active ? 1.5 : 1}
              />
              <circle
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={`Traverse to ${neighbor.title} by ${artistLine(neighbor.artists)}`}
                aria-current={active ? "true" : undefined}
                r={NEIGHBOR_R}
                className={cn(
                  "fill-background stroke-foreground/70 transition-[fill,stroke] duration-200",
                  "cursor-pointer outline-none",
                  "focus-visible:stroke-foreground focus-visible:stroke-[2.5]",
                  active && "fill-foreground stroke-foreground",
                  disabled && "pointer-events-none opacity-50",
                )}
                strokeWidth={1.5}
                onClick={() => {
                  if (!disabled) onSelectNeighbor(neighbor.id);
                }}
                onKeyDown={(event) => {
                  if (disabled) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectNeighbor(neighbor.id);
                  }
                }}
                onFocus={() => onActiveNeighborChange?.(neighbor.id)}
                onBlur={() => onActiveNeighborChange?.(null)}
                onMouseEnter={() => onActiveNeighborChange?.(neighbor.id)}
                onMouseLeave={() => onActiveNeighborChange?.(null)}
              />
              <text
                textAnchor="start"
                x={NEIGHBOR_R + 10}
                y={4}
                className="pointer-events-none fill-foreground text-[11px] font-medium"
              >
                {truncate(neighbor.title, 18)}
              </text>
            </g>
          );
        })}

        {layout.overflow > 0 ? (
          <text
            x={layout.width * 0.72}
            y={layout.height - 14}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            +{layout.overflow} more in the list
          </text>
        ) : null}
      </svg>
    </div>
  );
}
