"use client";

import Link from "next/link";

import { Badge } from "@selecta/ui/components/badge";

import type { GraphSetMode } from "@/components/sequences/use-graph-set-mode";

export function GraphSetRail({ mode }: { mode: GraphSetMode }) {
  const position = mode.total === 0 ? 0 : mode.index + 1;
  const upcoming = mode.upcomingTitles;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {mode.workspaceHref ? (
          <Link
            href={mode.workspaceHref}
            className="text-card-title text-brand truncate hover:underline"
          >
            {mode.title}
          </Link>
        ) : (
          <p className="text-card-title truncate">{mode.title}</p>
        )}
        <span className="text-numeric text-muted-foreground">
          {position} / {mode.total}
        </span>
        {upcoming.length > 0 ? (
          <span className="text-caption truncate">next · {upcoming.join(" · ")}</span>
        ) : (
          <span className="text-caption">end of the {mode.kind === "block" ? "block" : "set"}</span>
        )}
      </div>
      {mode.loadError ? <p className="text-destructive text-caption">{mode.loadError}</p> : null}
    </div>
  );
}

export function GraphSetPinBadges({
  onScript,
  alternates,
}: {
  onScript: boolean;
  alternates: Array<{ id: string; label: string | null }>;
}) {
  return (
    <>
      {onScript ? <Badge variant="brand">on script</Badge> : null}
      {alternates.map((item) => (
        <Badge key={item.id} variant="tertiary">
          {item.label?.trim() || "alternate"}
        </Badge>
      ))}
    </>
  );
}
