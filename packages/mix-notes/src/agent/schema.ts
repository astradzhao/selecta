import { z } from "zod";

import { NOTE_TYPES, TRANSITION_QUALITIES } from "../extraction-schema";

export const MENTION_RESOLUTION_STATUSES = [
  "resolved",
  "catalog_match",
  "ambiguous",
  "unresolved",
] as const;
export type MentionResolutionStatus = (typeof MENTION_RESOLUTION_STATUSES)[number];

/**
 * OpenAI structured outputs require every `properties` key to appear in `required`.
 * Represent "missing" values as `null` — never Zod `.optional()`.
 */
const nullableNonNegInt = z.number().int().nonnegative().nullable();
const nullableNonEmptyString = z.string().min(1).nullable();
const nullableString = z.string().nullable();
const nullableConfidence = z.number().min(0).max(1).nullable();

/** Opaque handles returned by tools: `graph:<id>` or `spotify:<providerId>`. */
export const CandidateHandleSchema = z
  .string()
  .regex(/^(graph|spotify):.+/, 'Candidate handle must be "graph:…" or "spotify:…"');

export const NoteMentionPlanSchema = z.object({
  mentionId: z.string().min(1),
  mention: z.string().min(1),
  titleHint: nullableString,
  artistHint: nullableString,
  selectedCandidateId: CandidateHandleSchema.nullable(),
  resolutionStatus: z.enum(MENTION_RESOLUTION_STATUSES),
  confidence: nullableConfidence,
  ambiguityReason: nullableString,
});
export type NoteMentionPlan = z.infer<typeof NoteMentionPlanSchema>;

export const NoteTransitionPlanSchema = z.object({
  fromMentionId: z.string().min(1),
  toMentionId: z.string().min(1),
  fromBar: nullableNonNegInt,
  toBar: nullableNonNegInt,
  barsOverlap: nullableNonNegInt,
  technique: nullableNonEmptyString,
  intent: nullableNonEmptyString,
  quality: z.enum(TRANSITION_QUALITIES).nullable(),
  notes: nullableString,
});
export type NoteTransitionPlan = z.infer<typeof NoteTransitionPlanSchema>;

export const NoteProcessingPlanSchema = z.object({
  noteType: z.enum(NOTE_TYPES),
  mentions: z.array(NoteMentionPlanSchema),
  transitions: z.array(NoteTransitionPlanSchema),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()),
});
export type NoteProcessingPlan = z.infer<typeof NoteProcessingPlanSchema>;

export function parseCandidateHandle(
  handle: string,
): { kind: "graph" | "spotify"; id: string } | null {
  const match = /^(graph|spotify):(.+)$/.exec(handle.trim());
  if (!match) {
    return null;
  }
  return { kind: match[1] as "graph" | "spotify", id: match[2]! };
}

export function graphCandidateHandle(trackId: string): string {
  return `graph:${trackId}`;
}

export function spotifyCandidateHandle(providerId: string): string {
  return `spotify:${providerId}`;
}
