/**
 * Intent/technique are free-form text columns today with controlled allow-lists
 * for filters, chips, and validation.
 *
 * This module is client-safe: no runtime imports from `client` / `pg` / drizzle
 * schema tables. Import from `@selecta/library/constants` in browser code.
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
 * Must stay aligned with Postgres `folder_kind` enum (folder | playlist).
 */
export const FOLDER_KINDS = ["folder", "playlist"] as const;

export type FolderKind = (typeof FOLDER_KINDS)[number];

const folderKindSet: ReadonlySet<string> = new Set(FOLDER_KINDS);

export function isFolderKind(value: string): value is FolderKind {
  return folderKindSet.has(value);
}

/**
 * Sequence kind on `blocks` — filter label only (DJ-111).
 * Must stay aligned with Postgres `block_kind` enum (block | set).
 */
export const BLOCK_KINDS = ["block", "set"] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

const blockKindSet: ReadonlySet<string> = new Set(BLOCK_KINDS);

export function isBlockKind(value: string): value is BlockKind {
  return blockKindSet.has(value);
}

/** Derived gap states. Only `seam` is stored; the rest are computed at read time. */
export const GAP_STATES = ["linked", "available", "unmapped", "seam"] as const;

export type GapState = (typeof GAP_STATES)[number];

const gapStateSet: ReadonlySet<string> = new Set(GAP_STATES);

export function isGapState(value: string): value is GapState {
  return gapStateSet.has(value);
}

/**
 * Max nesting depth for block connectors (cycle check + read-time expansion).
 * Depth 0 = no nested blocks.
 */
export const SEQUENCE_MAX_NESTING_DEPTH = 8;
