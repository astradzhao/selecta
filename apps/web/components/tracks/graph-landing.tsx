"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@selecta/ui/components/dialog";
import { EmptyState } from "@selecta/ui/components/empty-state";
import { ListSkeleton } from "@selecta/ui/components/list-skeleton";
import { SearchField } from "@selecta/ui/components/search-field";
import { cn } from "@selecta/ui/lib/utils";

import { ApiClientError } from "@/lib/api/client";
import { motionDelay } from "@/lib/motion";
import { listTracks, type ApiTrack } from "@/lib/tracks/api";

function artistLine(artists: { name: string }[]): string {
  return artists.map((a) => a.name).join(", ") || "Unknown artist";
}

export function TrackPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Choose a starting track",
  description = "Search your library, then start the graph explorer from that song.",
  confirmLabel = "Start with this track",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (track: ApiTrack) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<ApiTrack[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSearch] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const delay = query.trim() ? 200 : 0;
    const handle = window.setTimeout(() => {
      startSearch(async () => {
        try {
          const response = await listTracks({
            query: query.trim() || undefined,
            limit: 40,
          });
          if (cancelled) return;
          setTracks(response.tracks);
          setError(null);
          setHasSearched(true);
          setSelectedId((current) =>
            current && response.tracks.some((t) => t.id === current) ? current : null,
          );
        } catch (err) {
          if (cancelled) return;
          setTracks([]);
          setHasSearched(true);
          setError(err instanceof ApiClientError ? err.message : "Failed to search library.");
        }
      });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setSelectedId(null);
      setError(null);
      setHasSearched(false);
      setTracks([]);
    }
    onOpenChange(next);
  }

  const selected = tracks.find((t) => t.id === selectedId) ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 duration-300 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-5 py-4 pe-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          <SearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or artist…"
            autoFocus
          />

          {error ? <Alert variant="destructive">{error}</Alert> : null}

          {/* viewport-capped scroller — keep the arbitrary max-height */}
          <div
            className={cn(
              "border-border max-h-[min(50vh,22rem)] overflow-y-auto overflow-x-hidden rounded-xl border",
              "transition-opacity duration-300",
              pending && hasSearched ? "opacity-70" : "opacity-100",
            )}
          >
            {!hasSearched && pending ? (
              <ListSkeleton
                rows={4}
                aria-label="Loading library"
                className="rounded-none border-0"
              />
            ) : tracks.length === 0 ? (
              <EmptyState compact className="rounded-none border-0 px-4 py-8 text-center">
                {query.trim() ? "No tracks match that search." : "Your library is empty."}
              </EmptyState>
            ) : (
              <ul className="divide-border divide-y">
                {tracks.map((track, index) => {
                  const active = track.id === selectedId;
                  return (
                    <li
                      key={track.id}
                      className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 fill-mode-both"
                      style={{
                        animationDelay: `${Math.min(index, 12) * 28}ms`,
                        animationDuration: "320ms",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(track.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200",
                          "hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none",
                          active && "bg-muted",
                        )}
                      >
                        <div className="bg-muted relative size-11 shrink-0 overflow-hidden rounded-lg">
                          {track.artworkUrl ? (
                            <Image
                              src={track.artworkUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="44px"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-card-title truncate">{track.title}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {artistLine(track.artists)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "border-border size-4 shrink-0 rounded-full border transition-all duration-200",
                            active && "border-selected bg-selected scale-110",
                          )}
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="m-0 gap-3 rounded-none border-t px-5 py-3.5 sm:items-center sm:justify-between">
          <p className="text-muted-foreground hidden text-xs sm:block">
            {selected ? `Selected: ${selected.title}` : "Select a track to continue"}
          </p>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onSelect(selected);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GraphLanding({ onStart }: { onStart: (trackId: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function startWithTrack(track: ApiTrack) {
    setLeaving(true);
    setPickerOpen(false);
    window.setTimeout(() => {
      onStart(track.id);
    }, motionDelay(220));
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-1 flex-col items-center justify-center py-16 text-center",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 duration-500",
          leaving &&
            "pointer-events-none opacity-0 transition-all duration-300 motion-safe:-translate-y-2",
        )}
      >
        <div className="border-border/80 bg-surface-1 mb-8 flex size-20 items-center justify-center rounded-full border">
          <div className="border-foreground/25 relative size-10">
            <span className="bg-foreground absolute top-1/2 left-0 h-px w-full -translate-y-1/2" />
            <span className="bg-foreground absolute top-0 left-1/2 h-full w-px -translate-x-1/2" />
            <span className="border-foreground absolute top-1/2 left-0 size-2.5 -translate-y-1/2 rounded-full border-2 bg-background" />
            <span className="border-foreground absolute top-0 left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 bg-background" />
            <span className="border-foreground absolute right-0 bottom-0 size-2.5 rounded-full border-2 bg-foreground" />
          </div>
        </div>
        <p className="text-eyebrow">Graph explorer</p>
        <h1 className="text-page-title mt-3 max-w-md text-balance">
          Choose a track to get started
        </h1>
        <p className="text-body text-muted-foreground mt-3 max-w-md">
          Pick a song from your library, then browse outbound transitions and walk the mix graph hop
          by hop.
        </p>
        <Button type="button" size="lg" className="mt-8" onClick={() => setPickerOpen(true)}>
          Choose a track
        </Button>
      </div>

      <TrackPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={startWithTrack} />
    </>
  );
}
