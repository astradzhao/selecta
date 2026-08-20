"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { DataListRow } from "@selecta/ui/components/data-list";
import { cn } from "@selecta/ui/lib/utils";

import { artistLine, formatDuration } from "@/lib/format";
import { CRATE_SUBGENRE_LIMIT, CRATE_TRACK_GRID, formatBpmKey } from "@/lib/tracks/crate-row";
import { TRACK_ROW_ARTWORK_PX } from "@/lib/tracks/track-row-item";
import type { ApiTrack } from "@/lib/tracks/types";

const ARTWORK_PX = TRACK_ROW_ARTWORK_PX.sm;

const CRATE_ROW_CLASS = cn(
  CRATE_TRACK_GRID,
  "hover:bg-surface-2 focus-visible:bg-surface-2 min-h-14 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
);

function CrateMeta({
  children,
  empty = false,
  always = false,
}: {
  children: ReactNode;
  empty?: boolean;
  always?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-crate-meta min-w-0 text-center",
        always ? null : "hidden sm:block",
        empty && "opacity-40",
      )}
    >
      {children}
    </span>
  );
}

function CrateEdgeCount({ count, direction }: { count: number; direction: "in" | "out" }) {
  if (count === 0) {
    return <CrateMeta empty>—</CrateMeta>;
  }

  const Icon = direction === "in" ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <CrateMeta>
      <span className="text-brand inline-flex items-center justify-center gap-0.5 font-medium">
        <Icon className="size-3" aria-hidden />
        {count}
      </span>
    </CrateMeta>
  );
}

export function LibraryTrackRow({ track }: { track: ApiTrack }) {
  const bpmKey = formatBpmKey(track.bpm, track.musicalKey);
  const duration = formatDuration(track.durationSec);
  const inbound = track.inboundTransitionCount ?? 0;
  const outbound = track.outboundTransitionCount ?? 0;
  const subgenres = track.subgenres.slice(0, CRATE_SUBGENRE_LIMIT);

  return (
    <DataListRow interactive={false}>
      <Link
        href={`/tracks/${track.id}`}
        aria-label={`${track.title}. ${inbound} inbound, ${outbound} outbound.`}
        className={CRATE_ROW_CLASS}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="bg-muted ring-border relative size-10 shrink-0 overflow-hidden rounded-md ring-1 ring-inset">
            {track.artworkUrl ? (
              <Image
                src={track.artworkUrl}
                alt=""
                fill
                className="object-cover"
                sizes={`${ARTWORK_PX}px`}
              />
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="text-card-title min-w-0 truncate">{track.title}</span>
              {subgenres.map((item) => (
                <Badge key={item.id} variant="secondary" className="max-w-36 truncate">
                  {item.name}
                </Badge>
              ))}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {artistLine(track.artists)}
            </span>
          </span>
        </span>
        <CrateMeta empty={bpmKey === "- / -"}>{bpmKey}</CrateMeta>
        <CrateEdgeCount count={inbound} direction="in" />
        <CrateEdgeCount count={outbound} direction="out" />
        <CrateMeta always empty={!duration}>
          {duration ?? "—"}
        </CrateMeta>
      </Link>
    </DataListRow>
  );
}

export function LibraryTrackColumnHeader() {
  return (
    <div
      className={cn(CRATE_TRACK_GRID, "text-eyebrow bg-surface-1 hidden h-8 border-b sm:grid")}
      aria-hidden
    >
      <span>Track</span>
      <span className="text-center">BPM / Key</span>
      <span className="text-center">In</span>
      <span className="text-center">Out</span>
      <span className="text-center">Time</span>
    </div>
  );
}
