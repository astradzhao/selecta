import type { ApiTrack } from "@/lib/api";

export type LibraryCacheEntry = {
  tracks: ApiTrack[];
  /** `${count}:${latestUpdatedAt ?? ""}` from GET /tracks/stats */
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
}): string {
  return `${stats.count}:${stats.latestUpdatedAt ?? ""}`;
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
