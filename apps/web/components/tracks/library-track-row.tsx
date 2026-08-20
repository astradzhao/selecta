"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { DataListRow } from "@selecta/ui/components/data-list";
import { cn } from "@selecta/ui/lib/utils";

import { artistLine, formatDuration } from "@/lib/format";
import { CRATE_TRACK_GRID, formatBpmKey } from "@/lib/tracks/crate-row";
import { TRACK_ROW_ARTWORK_PX } from "@/lib/tracks/track-row-item";
import type { ApiTrack } from "@/lib/tracks/types";

const ARTWORK_PX = TRACK_ROW_ARTWORK_PX.sm;

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
        "text-crate-meta",
        always ? null : "hidden sm:block",
        empty ? "text-center opacity-40" : "text-right",
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
      <span className="text-brand inline-flex items-center justify-end gap-0.5 font-medium">
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
  const subgenre = track.subgenres[0];

  return (
    <DataListRow className={cn(CRATE_TRACK_GRID, "min-h-14 py-0")}>
      <Link
        href={`/tracks/${track.id}`}
        aria-label={`${track.title}. ${inbound} inbound, ${outbound} outbound.`}
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
              <span className="text-card-title truncate">{track.title}</span>
              {subgenre ? (
                <Badge variant="secondary" className="max-w-28 shrink-0 truncate">
                  {subgenre.name}
                </Badge>
              ) : null}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {artistLine(track.artists)}
            </span>
          </span>
        </span>
        <CrateMeta empty={!bpmKey}>{bpmKey ?? "—"}</CrateMeta>
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
      <span className="text-right">BPM · Key</span>
      <span className="text-right">In</span>
      <span className="text-right">Out</span>
      <span className="text-right">Time</span>
    </div>
  );
}
