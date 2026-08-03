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
