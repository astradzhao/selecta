"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

import { ApiClientError } from "@/lib/api/client";
import { getLibraryStats, listTracks, type ApiTrack } from "@/lib/tracks/api";
import {
  libraryCacheKey,
  libraryFingerprint,
  readLibraryCache,
  writeLibraryCache,
} from "@/lib/library-cache";
import { TrackChips } from "@/components/tracks/track-chips";

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
  const isFirstFetch = useRef(true);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const hasFilters = Boolean(query || subgenre || folder);
  const isInitialLoading = !hasFetched && !error;

  useEffect(() => {
    let cancelled = false;
    // Debounce filter typing only — first paint should check immediately so we
    // never flash the empty state before data arrives.
    const delay = isFirstFetch.current ? 0 : 220;
    isFirstFetch.current = false;

    const filters = { query, subgenre, folder };
    const cacheKey = libraryCacheKey(filters);
    const cached = readLibraryCache(cacheKey);
    if (cached && !sameTrackList(tracksRef.current, cached.tracks)) {
      setTracks(cached.tracks);
      setError(null);
      setHasFetched(true);
    } else if (cached) {
      setError(null);
      setHasFetched(true);
    }

    const handle = window.setTimeout(() => {
      void (async () => {
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
            query,
            subgenre,
            folder,
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
          setError(
            err instanceof ApiClientError
              ? err.code === "graph_not_configured"
                ? "The local track database isn’t running. Start the full stack with `pnpm dev`."
                : err.message
              : "Failed to load library. Is the API running?",
          );
          setHasFetched(true);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, subgenre, folder]);

  return (
    <div className="space-y-10">
      <header className="border-border space-y-2 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
        <p className="text-muted-foreground max-w-xl text-sm">
          Search your tracks or narrow the list by Subgenre and Folder.
        </p>
      </header>

      <section aria-label="Library filters" className="space-y-3">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="library-q">Search</Label>
            <div className="relative">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="library-q"
                className="pl-10"
                placeholder="Title or artist"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
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
            <p className="text-muted-foreground text-xs" aria-live="polite">
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
          <div className="border-border bg-muted/30 rounded-xl border px-5 py-6">
            <h2 className="font-medium">Library unavailable</h2>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm">{error}</p>
          </div>
        ) : isInitialLoading ? (
          <div
            className="border-border text-muted-foreground rounded-xl border px-5 py-10 text-sm"
            aria-busy="true"
          >
            Loading library…
          </div>
        ) : (
          <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {tracks.map((track) => (
              <li key={track.id}>
                <Link
                  href={`/tracks/${track.id}`}
                  className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
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
                      <p className="truncate font-medium">{track.title}</p>
                      <p className="text-muted-foreground truncate text-sm">
                        {track.artists.map((artist) => artist.name).join(", ") || "Unknown artist"}
                      </p>
                    </div>
                    <TrackChips subgenres={track.subgenres} folders={track.folders} />
                  </div>
                </Link>
              </li>
            ))}
            {hasFetched && tracks.length === 0 ? (
              <li className="flex flex-col items-start gap-3 px-5 py-10">
                <div>
                  <h2 className="font-medium">
                    {hasFilters ? "No matching tracks" : "No tracks yet"}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {hasFilters
                      ? "Try clearing a filter or searching for something else."
                      : "Add a track to start building your library."}
                  </p>
                </div>
                {!hasFilters ? (
                  <Button asChild size="sm">
                    <Link href="/tracks/new">Add your first track</Link>
                  </Button>
                ) : null}
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}
