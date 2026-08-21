"use client";

import Image from "next/image";
import { useState } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { useTrackSearch } from "@/hooks/use-track-search";
import { artistLine } from "@/lib/format";
import type { CatalogTrack } from "@/lib/catalog/types";
import { formatBpmKey } from "@/lib/tracks/crate-row";
import type { ApiTrack } from "@/lib/tracks/types";
import {
  catalogAlreadyInLibrary,
  sameEndpoint,
  type EndpointSelection,
} from "@/lib/transitions/endpoint-selection";

function SlotArt({ url }: { url?: string | null }) {
  return (
    <span className="bg-muted ring-border relative size-10 shrink-0 overflow-hidden rounded-md ring-1 ring-inset">
      {url ? <Image src={url} alt="" fill className="object-cover" sizes="40px" /> : null}
    </span>
  );
}

function HitRow({
  title,
  artists,
  artworkUrl,
  badge,
  onSelect,
}: {
  title: string;
  artists: string;
  artworkUrl: string | null;
  badge: { label: string; variant: "success" | "info" };
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="hover:bg-surface-2 flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <SlotArt url={artworkUrl} />
      <span className="min-w-0 flex-1">
        <span className="text-card-title block truncate">{title}</span>
        <span className="text-muted-foreground block truncate text-xs">{artists}</span>
      </span>
      <Badge variant={badge.variant} className="font-normal">
        {badge.label}
      </Badge>
    </button>
  );
}

export function TransitionEndpointField({
  id,
  label,
  selected,
  opposite,
  disabled,
  autoFocus,
  onSelect,
  onClear,
}: {
  id: string;
  label: string;
  selected: EndpointSelection | null;
  opposite: EndpointSelection | null;
  disabled?: boolean;
  autoFocus?: boolean;
  onSelect: (selection: EndpointSelection) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const picking = selected == null;
  const trimmed = query.trim();
  const libraryExcludeIds = opposite?.kind === "library" ? [opposite.track.id] : [];

  const library = useTrackSearch({
    source: "library",
    query,
    enabled: picking && !disabled,
    limit: 8,
    minQueryLength: 1,
    excludeIds: libraryExcludeIds,
    resource: "library",
  });
  const catalog = useTrackSearch({
    source: "catalog",
    query,
    enabled: picking && !disabled && trimmed.length >= 2,
    limit: 10,
    minQueryLength: 2,
    resource: "the catalog",
  });

  const libraryHits = library.libraryTracks.filter(
    (track) => !sameEndpoint({ kind: "library", track }, opposite),
  );
  const catalogHits =
    trimmed.length < 2
      ? []
      : catalog.catalogTracks.filter(
          (track) =>
            !sameEndpoint({ kind: "catalog", track }, opposite) &&
            !catalogAlreadyInLibrary(track, libraryHits),
        );

  const searching = library.searching || (trimmed.length >= 2 && catalog.searching);
  const showResults = picking && trimmed.length >= 1;
  const error = [library.error, trimmed.length >= 2 ? catalog.error : null]
    .filter(Boolean)
    .join(" ");

  function pickLibrary(track: ApiTrack) {
    onSelect({ kind: "library", track });
    setQuery("");
  }

  function pickCatalog(track: CatalogTrack) {
    onSelect({ kind: "catalog", track });
    setQuery("");
  }

  const title = selected?.kind === "library" ? selected.track.title : (selected?.track.title ?? "");
  const artists =
    selected == null
      ? ""
      : selected.kind === "library"
        ? artistLine(selected.track.artists)
        : artistLine(selected.track.artists);
  const artworkUrl = selected?.track.artworkUrl ?? null;
  const bpmKey =
    selected?.kind === "library"
      ? formatBpmKey(selected.track.bpm, selected.track.musicalKey)
      : null;

  return (
    <div className="relative min-w-0">
      {selected ? (
        <div className="border-border bg-background flex h-14 min-w-0 items-center gap-3 rounded-lg border px-3">
          <SlotArt url={artworkUrl} />
          <span className="min-w-0 flex-1">
            <span className="text-card-title block truncate">{title}</span>
            <span className="text-muted-foreground block truncate text-xs">{artists}</span>
          </span>
          {selected.kind === "catalog" ? (
            <Badge variant="info" className="font-normal">
              Will import
            </Badge>
          ) : (
            <span className="text-crate-meta hidden shrink-0 sm:block">{bpmKey}</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={disabled}
            onClick={() => {
              onClear();
              setQuery("");
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <>
          <label
            className={cn(
              "border-input flex h-14 min-w-0 items-center rounded-lg border border-dashed bg-transparent px-3.5 transition-colors",
              "focus-within:border-ring focus-within:ring-ring/50 focus-within:border-solid focus-within:ring-3",
            )}
          >
            <input
              id={id}
              type="search"
              value={query}
              autoFocus={autoFocus}
              autoComplete="off"
              disabled={disabled}
              placeholder="Search tracks…"
              aria-label={label}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
          </label>
          {showResults ? (
            <div className="border-border bg-popover absolute top-[calc(100%+6px)] right-0 left-0 z-20 max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border shadow-md">
              {error ? (
                <div className="p-2">
                  <Alert variant="destructive">{error}</Alert>
                </div>
              ) : null}
              {searching && libraryHits.length === 0 && catalogHits.length === 0 ? (
                <p className="text-caption px-2.5 py-2">Searching…</p>
              ) : null}
              {libraryHits.length > 0 ? (
                <div>
                  <p className="text-eyebrow bg-surface-1 border-border border-b px-2.5 py-1.5">
                    In library
                  </p>
                  {libraryHits.map((track) => (
                    <HitRow
                      key={track.id}
                      title={track.title}
                      artists={artistLine(track.artists)}
                      artworkUrl={track.artworkUrl}
                      badge={{ label: "In library", variant: "success" }}
                      onSelect={() => pickLibrary(track)}
                    />
                  ))}
                </div>
              ) : null}
              {catalogHits.length > 0 ? (
                <div>
                  <p className="text-eyebrow bg-surface-1 border-border border-b px-2.5 py-1.5">
                    Catalog
                  </p>
                  {catalogHits.map((track) => (
                    <HitRow
                      key={`${track.provider}:${track.providerId}`}
                      title={track.title}
                      artists={artistLine(track.artists)}
                      artworkUrl={track.artworkUrl}
                      badge={{ label: "Will import", variant: "info" }}
                      onSelect={() => pickCatalog(track)}
                    />
                  ))}
                </div>
              ) : null}
              {!searching &&
              !error &&
              library.hasFetched &&
              libraryHits.length === 0 &&
              catalogHits.length === 0 ? (
                <p className="text-caption px-2.5 py-2">No matching tracks.</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
