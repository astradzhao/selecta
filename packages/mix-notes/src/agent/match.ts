import type { SubmissionMentionPlan } from "./schema";
import type { TrackCandidate } from "./services";

/**
 * Strip common DJ cue suffixes that models sometimes leave in mention text.
 * Bars belong on the transition object, not in Spotify search queries.
 */
export function stripCueSuffixesFromSearchQuery(query: string): string {
  return query
    .replace(/\b(?:at\s+)?(?:from\s+)?bars?\s*\d+(?:\s*[-–—]\s*\d+)?\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Search string for library/Spotify.
 * Prefer the parser's `mention` (a ready-made query). Fall back to legacy
 * title/artist hints for older drafts.
 */
export function mentionSearchQuery(mention: SubmissionMentionPlan): string {
  const fromMention = mention.mention.trim();
  if (fromMention) return stripCueSuffixesFromSearchQuery(fromMention);
  const title = mention.titleHint?.trim() ?? "";
  const artist = mention.artistHint?.trim() ?? "";
  return stripCueSuffixesFromSearchQuery([title, artist].filter(Boolean).join(" "));
}

/** Spotify uses the same plain query as the library. */
export function mentionSpotifySearchQuery(mention: SubmissionMentionPlan): string {
  return mentionSearchQuery(mention);
}

/** Trust catalog ranking: first search hit wins. */
export function topSearchHit(candidates: TrackCandidate[]): TrackCandidate | null {
  return candidates[0] ?? null;
}
