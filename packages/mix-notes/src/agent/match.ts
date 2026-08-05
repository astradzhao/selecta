import type { NoteMentionPlan } from "./schema";
import type { TrackCandidate } from "./services";

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function scoreTitleArtist(mention: NoteMentionPlan, candidate: TrackCandidate): number {
  const title = normalizeName(mention.titleHint ?? mention.mention);
  const artist = normalizeName(mention.artistHint ?? "");
  const candTitle = normalizeName(candidate.title);
  const candArtists = candidate.artists.map(normalizeName);

  let score = 0;
  if (title && candTitle === title) score += 0.6;
  else if (title && (candTitle.includes(title) || title.includes(candTitle))) score += 0.35;

  if (artist) {
    if (candArtists.some((name) => name === artist)) score += 0.4;
    else if (candArtists.some((name) => name.includes(artist) || artist.includes(name)))
      score += 0.2;
  } else {
    score += 0.1;
  }
  return Math.min(1, score);
}

/** Return the unique best candidate when score and margin gates pass. */
export function uniqueBestCandidate(
  mention: NoteMentionPlan,
  candidates: TrackCandidate[],
  minScore = 0.75,
  margin = 0.15,
): TrackCandidate | null {
  if (candidates.length === 0) return null;
  const ranked = [...candidates]
    .map((candidate) => ({ candidate, score: scoreTitleArtist(mention, candidate) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]!;
  const second = ranked[1];
  if (best.score < minScore) return null;
  if (second && best.score - second.score < margin) return null;
  return best.candidate;
}

/** Build a compact search query from mention hints. */
export function mentionSearchQuery(mention: NoteMentionPlan): string {
  const title = mention.titleHint?.trim() || mention.mention.trim();
  const artist = mention.artistHint?.trim();
  if (artist && title) {
    return `${title} ${artist}`.trim();
  }
  return title;
}
