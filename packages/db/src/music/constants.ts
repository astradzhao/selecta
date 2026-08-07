import type { FolderKind } from "../schema";

/**
 * Intent/technique are free-form text columns today with controlled allow-lists
 * for filters, chips, and validation.
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

/**
 * Optional `kind` on folders — product copy only.
 * `section` was dropped in DJ-81; Postgres `folder_kind` is folder | playlist only.
 */
export const FOLDER_KINDS = ["folder", "playlist"] as const satisfies ReadonlyArray<FolderKind>;

const folderKindSet: ReadonlySet<string> = new Set(FOLDER_KINDS);

export function isFolderKind(value: string): value is FolderKind {
  return folderKindSet.has(value);
}
