import { TRANSITION_QUALITIES } from "./constants";

/**
 * Comparator input for neighborhood ranking. Kept free of db types so web
 * clients can import `@selecta/library/neighborhood-rank` without drizzle.
 */
export type RankableNeighbor = {
  track: { title: string };
  transition: {
    id?: string | null;
    proposalKey?: string | null;
    confidence?: number | null;
    fromBar?: number | null;
    quality?: string | null;
  };
};

/** Lower is better. Matches ARCHITECTURE §6.4 / §11 quality preference. */
export function transitionQualityRank(quality: string | null | undefined): number {
  if (quality == null) return TRANSITION_QUALITIES.length;
  const index = (TRANSITION_QUALITIES as readonly string[]).indexOf(quality);
  return index === -1 ? TRANSITION_QUALITIES.length : index;
}

/**
 * Stable ranking for outbound neighbors (ARCHITECTURE §11, local MVP):
 * quality → confidence DESC → fromBar ASC → title → edge id → proposalKey.
 */
export function compareNeighborhoodNeighbors(a: RankableNeighbor, b: RankableNeighbor): number {
  const qualityDelta =
    transitionQualityRank(a.transition.quality) - transitionQualityRank(b.transition.quality);
  if (qualityDelta !== 0) return qualityDelta;

  const confA = a.transition.confidence;
  const confB = b.transition.confidence;
  if (confA != null || confB != null) {
    if (confA == null) return 1;
    if (confB == null) return -1;
    if (confA !== confB) return confB - confA;
  }

  const barA = a.transition.fromBar;
  const barB = b.transition.fromBar;
  if (barA != null || barB != null) {
    if (barA == null) return 1;
    if (barB == null) return -1;
    if (barA !== barB) return barA - barB;
  }

  const titleDelta = a.track.title.localeCompare(b.track.title, undefined, {
    sensitivity: "base",
  });
  if (titleDelta !== 0) return titleDelta;

  const idA = a.transition.id ?? "";
  const idB = b.transition.id ?? "";
  const idDelta = idA.localeCompare(idB);
  if (idDelta !== 0) return idDelta;

  const keyA = a.transition.proposalKey ?? "";
  const keyB = b.transition.proposalKey ?? "";
  return keyA.localeCompare(keyB);
}
