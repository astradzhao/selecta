"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { EmptyState } from "@selecta/ui/components/empty-state";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { ListSkeleton } from "@selecta/ui/components/list-skeleton";
import { SearchField } from "@selecta/ui/components/search-field";
import { StatePanel } from "@selecta/ui/components/state-panel";

import { TrackChips } from "@/components/tracks/track-chips";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { describeApiError } from "@/lib/api/errors";
import { artistLine } from "@/lib/format";
import {
  libraryCacheKey,
  libraryFingerprint,
  readLibraryCache,
  writeLibraryCache,
} from "@/lib/library-cache";
import { getLibraryStats, listTracks, type ApiTrack } from "@/lib/tracks/api";

function initialCacheKey() {
  return libraryCacheKey({ query: "", subgenre: "", folder: "" });
}

function sameTrackList(a: ApiTrack[], b: ApiTrack[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || left.id !== right.id || left.updatedAt !== right.updatedAt) {
      return false;
    }
  }
  return true;
}

export function LibraryList() {
  const [query, setQuery] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [folder, setFolder] = useState("");
  const initialCached = readLibraryCache(initialCacheKey());
  const [tracks, setTracks] = useState<ApiTrack[]>(() => initialCached?.tracks ?? []);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(() => initialCached != null);
  const tracksRef = useRef(tracks);
  const filters = useMemo(() => ({ query, subgenre, folder }), [query, subgenre, folder]);
  const debouncedFilters = useDebouncedValue(filters);
  const hasFilters = Boolean(query || subgenre || folder);
  const isInitialLoading = !hasFetched && !error;

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    let cancelled = false;
    const { query: nextQuery, subgenre: nextSubgenre, folder: nextFolder } = debouncedFilters;
    const cacheKey = libraryCacheKey({
      query: nextQuery,
      subgenre: nextSubgenre,
      folder: nextFolder,
    });

    void (async () => {
      const cached = readLibraryCache(cacheKey);
      if (cancelled) return;
      if (cached && !sameTrackList(tracksRef.current, cached.tracks)) {
        setTracks(cached.tracks);
        setError(null);
        setHasFetched(true);
      } else if (cached) {
        setError(null);
        setHasFetched(true);
      }

      try {
        const stats = await getLibraryStats();
        if (cancelled) return;

        const fingerprint = libraryFingerprint(stats);
        const current = readLibraryCache(cacheKey);
        if (current && current.fingerprint === fingerprint) {
          // Cache is fresh — leave rendered UI alone.
          return;
        }

        const response = await listTracks({
          query: nextQuery,
          subgenre: nextSubgenre,
          folder: nextFolder,
          limit: 100,
        });
        if (cancelled) return;
        writeLibraryCache(cacheKey, response.tracks, fingerprint);
        if (!sameTrackList(tracksRef.current, response.tracks)) {
          setTracks(response.tracks);
        }
        setError(null);
        setHasFetched(true);
      } catch (err) {
        if (cancelled) return;
        if (!readLibraryCache(cacheKey) && tracksRef.current.length === 0) {
          setTracks([]);
        }
        setError(describeApiError(err, { resource: "library" }));
        setHasFetched(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedFilters]);

  return (
    <div className="space-y-6">
      <section aria-label="Library filters" className="space-y-3">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="library-q">Search</Label>
            <SearchField
              id="library-q"
              placeholder="Title or artist"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-subgenre">Subgenre</Label>
            <Input
              id="filter-subgenre"
              placeholder="e.g. UKG"
              value={subgenre}
              onChange={(event) => setSubgenre(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-folder">Folder</Label>
            <Input
              id="filter-folder"
              placeholder="e.g. sunset set"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            />
          </div>
        </div>

        {!error || hasFilters ? (
          <div className="flex min-h-7 items-center justify-between gap-4">
            <p className="text-caption" aria-live="polite">
              {isInitialLoading
                ? "Loading library…"
                : error
                  ? null
                  : `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`}
            </p>
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setSubgenre("");
                  setFolder("");
                }}
              >
                <XIcon />
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-label="Tracks">
        {error && tracks.length === 0 ? (
          <StatePanel variant="error" title="Library unavailable" description={error} />
        ) : isInitialLoading ? (
          <ListSkeleton aria-label="Loading library" />
        ) : (
          <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {tracks.map((track) => (
              <li key={track.id}>
                <Link
                  href={`/tracks/${track.id}`}
                  className="hover:bg-surface-2 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md">
                    {track.artworkUrl ? (
                      <Image
                        src={track.artworkUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div>
                      <p className="text-card-title truncate">{track.title}</p>
                      <p className="text-muted-foreground truncate text-sm">
                        {artistLine(track.artists)}
                      </p>
                    </div>
                    <TrackChips subgenres={track.subgenres} />
                  </div>
                </Link>
              </li>
            ))}
            {hasFetched && tracks.length === 0 ? (
              <li>
                <EmptyState
                  title={hasFilters ? "No matching tracks" : "No tracks yet"}
                  description={
                    hasFilters
                      ? "Try clearing a filter or searching for something else."
                      : "Add a track to start building your library."
                  }
                >
                  {!hasFilters ? (
                    <Button asChild size="sm">
                      <Link href="/add">Add your first track</Link>
                    </Button>
                  ) : null}
                </EmptyState>
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}
