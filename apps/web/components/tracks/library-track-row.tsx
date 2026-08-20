"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { DataListRow } from "@selecta/ui/components/data-list";
import { cn } from "@selecta/ui/lib/utils";

import { artistLine, formatDuration } from "@/lib/format";
import { CRATE_TRACK_GRID, formatBpmKey } from "@/lib/tracks/crate-row";
import { TRACK_ROW_ARTWORK_PX } from "@/lib/tracks/track-row-item";
import type { ApiTrack } from "@/lib/tracks/types";

const ARTWORK_PX = TRACK_ROW_ARTWORK_PX.sm;

export function LibraryTrackRow({ track }: { track: ApiTrack }) {
  const bpmKey = formatBpmKey(track.bpm, track.musicalKey);
  const duration = formatDuration(track.durationSec);
  const outbound = track.outboundTransitionCount ?? 0;
  const subgenre = track.subgenres[0];

  return (
    <DataListRow className={cn(CRATE_TRACK_GRID, "min-h-14 py-0")}>
      <Link href={`/tracks/${track.id}`}>
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
        <span
          className={cn(
            "text-caption text-numeric hidden text-right sm:block",
            !bpmKey && "opacity-40",
          )}
        >
          {bpmKey ?? "—"}
        </span>
        <span className="text-caption text-numeric hidden text-right sm:block">
          {outbound > 0 ? (
            <span className="text-brand inline-flex items-center justify-end gap-1 font-medium">
              <ArrowRightIcon className="size-3" aria-hidden />
              {outbound}
            </span>
          ) : (
            <span className="opacity-40">none</span>
          )}
        </span>
        <span className={cn("text-caption text-numeric text-right", !duration && "opacity-40")}>
          {duration ?? "—"}
        </span>
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
      <span className="text-right">Transitions</span>
      <span className="text-right">Time</span>
    </div>
  );
}
