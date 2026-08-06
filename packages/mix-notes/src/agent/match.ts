import type { NoteMentionPlan } from "./schema";
import type { TrackCandidate } from "./services";

/**
 * Search string for library/Spotify.
 * Prefer the parser's `mention` (a ready-made query). Fall back to legacy
 * title/artist hints for older drafts.
 */
export function mentionSearchQuery(mention: NoteMentionPlan): string {
  const fromMention = mention.mention.trim();
  if (fromMention) return fromMention;
  const title = mention.titleHint?.trim() ?? "";
  const artist = mention.artistHint?.trim() ?? "";
  return [title, artist].filter(Boolean).join(" ").trim();
}

/** Spotify uses the same plain query as the library. */
export function mentionSpotifySearchQuery(mention: NoteMentionPlan): string {
  return mentionSearchQuery(mention);
}

/** Trust catalog ranking: first search hit wins. */
export function topSearchHit(candidates: TrackCandidate[]): TrackCandidate | null {
  return candidates[0] ?? null;
}
