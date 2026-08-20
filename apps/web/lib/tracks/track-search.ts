export type TrackSearchWhen = {
  minQueryLength: number;
  searchWhenEmpty: boolean;
};

export function shouldRunTrackSearch(
  query: string,
  { minQueryLength, searchWhenEmpty }: TrackSearchWhen,
): boolean {
  const trimmed = query.trim();
  if (!trimmed) return searchWhenEmpty;
  return trimmed.length >= minQueryLength;
}

export function librarySearchParams(
  query: string,
  limit: number,
): { query?: string; limit: number } {
  const trimmed = query.trim();
  return {
    query: trimmed || undefined,
    limit,
  };
}

export function excludeTracksById<T extends { id: string }>(
  tracks: T[],
  excludeIds: ReadonlySet<string> | readonly string[],
): T[] {
  const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);
  if (excluded.size === 0) return tracks;
  return tracks.filter((track) => !excluded.has(track.id));
}
