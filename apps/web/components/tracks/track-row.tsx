"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CheckIcon, PlusIcon } from "lucide-react";

import { DataListRow } from "@selecta/ui/components/data-list";
import { cn } from "@selecta/ui/lib/utils";

import { artistLine } from "@/lib/format";
import {
  TRACK_ROW_ARTWORK_PX,
  type TrackRowItem,
  type TrackRowSize,
} from "@/lib/tracks/track-row-item";

const ARTWORK_CLASS = {
  sm: "size-10 rounded-md",
  md: "size-12 rounded-md",
} as const;

export type TrackRowInteraction = "link" | "select" | "add" | "static";
export type TrackRowSelectedIndicator = "radio" | "check" | "none";
export type { TrackRowSize };

export function TrackRow({
  item,
  size = "md",
  interaction,
  href,
  selected = false,
  selectedIndicator = "none",
  onSelect,
  disabled = false,
  trailing,
  children,
  className,
  titleHref,
  style,
  bare = false,
}: {
  item: TrackRowItem;
  size?: TrackRowSize;
  interaction: TrackRowInteraction;
  href?: string;
  selected?: boolean;
  selectedIndicator?: TrackRowSelectedIndicator;
  onSelect?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
  titleHref?: string;
  style?: CSSProperties;
  /** Skip the list-item wrapper for compact selected-track summaries. */
  bare?: boolean;
}) {
  const artworkPx = TRACK_ROW_ARTWORK_PX[size];
  const body = (
    <>
      <div
        className={cn(
          "bg-muted ring-border relative shrink-0 overflow-hidden ring-1 ring-inset",
          ARTWORK_CLASS[size],
        )}
      >
        {item.artworkUrl ? (
          <Image
            src={item.artworkUrl}
            alt=""
            fill
            className="object-cover"
            sizes={`${artworkPx}px`}
          />
        ) : null}
      </div>
      <div className={cn("min-w-0 flex-1", children ? "space-y-1.5" : null)}>
        <div>
          {interaction === "static" && titleHref ? (
            <Link href={titleHref} className="text-card-title truncate hover:underline">
              {item.title}
            </Link>
          ) : (
            <p className="text-card-title truncate">{item.title}</p>
          )}
          <p
            className={cn("text-muted-foreground truncate", size === "sm" ? "text-xs" : "text-sm")}
          >
            {artistLine(item.artists)}
          </p>
        </div>
        {children}
      </div>
      {trailing}
      {interaction === "add" ? (
        <PlusIcon className="text-muted-foreground size-4 shrink-0" />
      ) : null}
      {selected && selectedIndicator === "check" ? (
        <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : null}
      {selectedIndicator === "radio" ? (
        <span
          className={cn(
            "border-border size-4 shrink-0 rounded-full border transition-all duration-200",
            selected && "border-brand bg-brand scale-110",
          )}
          aria-hidden
        />
      ) : null}
    </>
  );

  if (interaction === "static") {
    const inner = <div className="flex items-center gap-3 px-4 py-3">{body}</div>;
    if (bare) {
      return <div className={cn("flex min-w-0 flex-1 items-center gap-3", className)}>{body}</div>;
    }
    return (
      <DataListRow interactive={false} className={className} style={style}>
        {inner}
      </DataListRow>
    );
  }

  if (interaction === "link") {
    if (!href) {
      throw new Error('TrackRow interaction="link" requires href.');
    }
    return (
      <DataListRow className={cn("items-center gap-3", className)} style={style}>
        <Link href={href}>{body}</Link>
      </DataListRow>
    );
  }

  return (
    <DataListRow
      className={cn(
        "w-full items-center gap-3 text-left",
        selected && selectedIndicator === "check" && "bg-surface-3",
        selected && selectedIndicator === "radio" && "bg-muted",
        className,
      )}
      style={style}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={interaction === "select" ? selected : undefined}
        onClick={onSelect}
      >
        {body}
      </button>
    </DataListRow>
  );
}
