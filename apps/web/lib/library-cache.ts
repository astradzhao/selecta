import type { ApiTrack } from "@/lib/tracks/types";

import { getLibraryStats, listTracks } from "@/lib/tracks/api";

import type { TrackListFilters } from "./library/list-params";
import { trackListQuery } from "./library/list-params";

export type LibraryCacheEntry = {
  tracks: ApiTrack[];
  /** Fingerprint from GET /tracks/stats: tracks + transitions so crate counts stay fresh. */
  fingerprint: string;
};

const cache = new Map<string, LibraryCacheEntry>();

/** Stable key for library list filters. */
export function libraryCacheKey(input: {
  query?: string;
  subgenre?: string;
  folder?: string;
}): string {
  return [input.query?.trim() ?? "", input.subgenre?.trim() ?? "", input.folder?.trim() ?? ""].join(
    "|",
  );
}

export function libraryFingerprint(stats: {
  count: number;
  latestUpdatedAt: string | null;
  transitionCount?: number;
  latestTransitionUpdatedAt?: string | null;
}): string {
  return [
    stats.count,
    stats.latestUpdatedAt ?? "",
    stats.transitionCount ?? 0,
    stats.latestTransitionUpdatedAt ?? "",
  ].join(":");
}

export function readLibraryCache(key: string): LibraryCacheEntry | null {
  return cache.get(key) ?? null;
}

export function writeLibraryCache(key: string, tracks: ApiTrack[], fingerprint: string): void {
  cache.set(key, { tracks, fingerprint });
}

/** Drop all cached library lists (e.g. after createTrack). */
export function invalidateLibraryCache(): void {
  cache.clear();
}

export function sameTrackList(a: ApiTrack[], b: ApiTrack[]): boolean {
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

export function previewLibraryList(filters: TrackListFilters): ApiTrack[] | null {
  return readLibraryCache(libraryCacheKey(filters))?.tracks ?? null;
}

export type LibraryListDeps = {
  getLibraryStats: () => Promise<{
    count: number;
    latestUpdatedAt: string | null;
    transitionCount?: number;
    latestTransitionUpdatedAt?: string | null;
  }>;
  listTracks: (input: {
    query?: string;
    subgenre?: string;
    folder?: string;
    limit?: number;
  }) => Promise<{ tracks: ApiTrack[] }>;
};

const defaultLibraryListDeps: LibraryListDeps = {
  getLibraryStats,
  listTracks,
};

/** Network refresh for the Tracks list. Skip replace when the cache fingerprint is still fresh. */
export async function fetchLibraryListIfStale(
  filters: TrackListFilters,
  deps: LibraryListDeps = defaultLibraryListDeps,
): Promise<{ items: ApiTrack[]; hasMore: false; skipReplace: boolean }> {
  const cacheKey = libraryCacheKey(filters);
  const stats = await deps.getLibraryStats();
  const fingerprint = libraryFingerprint(stats);
  const cached = readLibraryCache(cacheKey);
  if (cached && cached.fingerprint === fingerprint) {
    return { items: cached.tracks, hasMore: false, skipReplace: true };
  }

  const response = await deps.listTracks(trackListQuery(filters));
  writeLibraryCache(cacheKey, response.tracks, fingerprint);
  return {
    items: response.tracks,
    hasMore: false,
    skipReplace: false,
  };
}
