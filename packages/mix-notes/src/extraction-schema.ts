import { z } from "zod";

/**
 * Structured output for free-form note extraction (DJ-33).
 *
 * Proposals are optional: empty song/transition lists are valid when the note
 * does not imply a graph mutation. Song links and transitions are never required.
 */

export const NOTE_TYPES = ["transition", "song_note", "unknown", "mixed"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const TRANSITION_QUALITIES = ["great", "ok", "risky"] as const;
export type TransitionQuality = (typeof TRANSITION_QUALITIES)[number];

const optionalNonNegInt = z.number().int().nonnegative().nullable().optional();
const optionalNonEmptyString = z.string().min(1).optional();

/** A song reference extracted from free-form text (unresolved until DJ-35). */
export const SongMentionSchema = z.object({
  /** Raw mention text as it appeared in the note. */
  mention: z.string().min(1),
  titleHint: z.string().optional(),
  artistHint: z.string().optional(),
  /** Neo4j track id once resolved; null/omitted means unresolved. */
  resolvedId: z.string().min(1).nullable().optional(),
});
export type SongMention = z.infer<typeof SongMentionSchema>;

/**
 * A proposed TRANSITION edge. All mix fields are optional so partial notes
 * (technique-only, bars-only, etc.) still validate.
 */
export const TransitionProposalSchema = z.object({
  fromMention: optionalNonEmptyString,
  toMention: optionalNonEmptyString,
  fromBar: optionalNonNegInt,
  toBar: optionalNonNegInt,
  barsOverlap: optionalNonNegInt,
  /** Free-form or seeded vocab (see `@selecta/graph` TRANSITION_TECHNIQUES). */
  technique: optionalNonEmptyString,
  /** Free-form or seeded vocab (see `@selecta/graph` TRANSITION_INTENTS). */
  intent: optionalNonEmptyString,
  quality: z.enum(TRANSITION_QUALITIES).optional(),
  notes: z.string().optional(),
});
export type TransitionProposal = z.infer<typeof TransitionProposalSchema>;

export const ExtractionProposalSchema = z.object({
  noteType: z.enum(NOTE_TYPES),
  songMentions: z.array(SongMentionSchema).default([]),
  transitionProposals: z.array(TransitionProposalSchema).default([]),
  /** Model confidence in [0, 1]. */
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()).default([]),
});
export type ExtractionProposal = z.infer<typeof ExtractionProposalSchema>;

/** Parse/validate an extraction proposal; throws ZodError on failure. */
export function parseExtractionProposal(input: unknown): ExtractionProposal {
  return ExtractionProposalSchema.parse(input);
}

/** Safe parse for API / preview paths that prefer a result object. */
export function safeParseExtractionProposal(input: unknown) {
  return ExtractionProposalSchema.safeParse(input);
}
