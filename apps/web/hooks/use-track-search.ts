"use client";

import { useEffect, useRef, useState } from "react";

import { DEFAULT_DEBOUNCE_MS, useDebouncedValue } from "@/hooks/use-debounced-value";
import { describeApiError } from "@/lib/api/errors";
import { searchCatalog, type CatalogTrack } from "@/lib/catalog/api";
import { listTracks, type ApiTrack } from "@/lib/tracks/api";
import {
  excludeTracksById,
  librarySearchParams,
  shouldRunTrackSearch,
} from "@/lib/tracks/track-search";

export type TrackSearchSource = "library" | "catalog";

export function useTrackSearch({
  source,
  query,
  enabled = true,
  limit,
  minQueryLength,
  searchWhenEmpty = false,
  excludeIds = [],
  resource,
}: {
  source: TrackSearchSource;
  query: string;
  enabled?: boolean;
  limit: number;
  minQueryLength: number;
  searchWhenEmpty?: boolean;
  excludeIds?: readonly string[];
  resource: string;
}): {
  libraryTracks: ApiTrack[];
  catalogTracks: CatalogTrack[];
  error: string | null;
  searching: boolean;
  hasFetched: boolean;
} {
  const debounceMs = query.trim() ? DEFAULT_DEBOUNCE_MS : searchWhenEmpty ? 0 : DEFAULT_DEBOUNCE_MS;
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const [libraryTracks, setLibraryTracks] = useState<ApiTrack[]>([]);
  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const excludeKey = excludeIds.join("\0");
  const excludeRef = useRef(excludeIds);

  useEffect(() => {
    excludeRef.current = excludeIds;
  }, [excludeIds]);

  useEffect(() => {
    if (!enabled) return;
    if (!shouldRunTrackSearch(debouncedQuery, { minQueryLength, searchWhenEmpty })) {
      return;
    }

    let cancelled = false;
    void (async () => {
      setSearching(true);
      try {
        if (source === "library") {
          const response = await listTracks(librarySearchParams(debouncedQuery, limit));
          if (cancelled) return;
          setLibraryTracks(excludeTracksById(response.tracks, excludeRef.current));
          setCatalogTracks([]);
        } else {
          const response = await searchCatalog(debouncedQuery.trim(), limit);
          if (cancelled) return;
          setCatalogTracks(response.results);
          setLibraryTracks([]);
        }
        setError(null);
        setHasFetched(true);
      } catch (err) {
        if (cancelled) return;
        setLibraryTracks([]);
        setCatalogTracks([]);
        setError(describeApiError(err, { fallback: `Failed to search ${resource}.` }));
        setHasFetched(true);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    source,
    debouncedQuery,
    enabled,
    limit,
    minQueryLength,
    searchWhenEmpty,
    excludeKey,
    resource,
  ]);

  return { libraryTracks, catalogTracks, error, searching, hasFetched };
}
