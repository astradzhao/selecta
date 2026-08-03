/**
 * Music graph schema seeds (v1).
 *
 * Intent/technique are string properties on TRANSITION edges and Cue nodes today
 * (not hub nodes yet). These are the controlled allowed values for filters, chips,
 * and validation; free-form labels may still be stored and normalized later.
 */

export const TRANSITION_INTENTS = [
  "build_hype",
  "cool_down",
  "maintain_energy",
  "peak_time",
  "mix_in",
  "mix_out",
] as const;

export type TransitionIntent = (typeof TRANSITION_INTENTS)[number];

export const TRANSITION_TECHNIQUES = [
  "high_pass_filter",
  "low_pass_filter",
  "bass_swap",
  "loop",
  "4_bar_loop",
  "echo_out",
  "cut",
  "blend",
] as const;

export type TransitionTechnique = (typeof TRANSITION_TECHNIQUES)[number];

const intentSet: ReadonlySet<string> = new Set(TRANSITION_INTENTS);
const techniqueSet: ReadonlySet<string> = new Set(TRANSITION_TECHNIQUES);

export function isTransitionIntent(value: string): value is TransitionIntent {
  return intentSet.has(value);
}

export function isTransitionTechnique(value: string): value is TransitionTechnique {
  return techniqueSet.has(value);
}

/** Neo4j node labels (music-only graph). */
export const NODE_LABELS = {
  Song: "Song",
  Artist: "Artist",
  Genre: "Genre",
  Cue: "Cue",
} as const;

export type NodeLabel = (typeof NODE_LABELS)[keyof typeof NODE_LABELS];

/** Neo4j relationship types. */
export const REL_TYPES = {
  BY: "BY",
  IN_GENRE: "IN_GENRE",
  TRANSITION: "TRANSITION",
  HAS_CUE: "HAS_CUE",
} as const;

export type RelType = (typeof REL_TYPES)[keyof typeof REL_TYPES];
