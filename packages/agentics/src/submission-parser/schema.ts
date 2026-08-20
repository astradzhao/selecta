import { z } from "zod";

import { TRANSITION_QUALITIES } from "@selecta/library/constants";

import { SUBMISSION_CONTENT_TYPES } from "./content-types";
import { CONFIDENCE_LEVELS } from "./confidence";

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

export const SubmissionMentionPlanSchema = z.object({
  mentionId: z.string().min(1),
  mention: z.string().min(1),
  titleHint: nullableString,
  artistHint: nullableString,
  selectedCandidateId: CandidateHandleSchema.nullable(),
  resolutionStatus: z.enum(MENTION_RESOLUTION_STATUSES),
  confidence: nullableConfidence,
  ambiguityReason: nullableString,
});
export type SubmissionMentionPlan = z.infer<typeof SubmissionMentionPlanSchema>;

export const SubmissionTransitionPlanSchema = z.object({
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
export type SubmissionTransitionPlan = z.infer<typeof SubmissionTransitionPlanSchema>;

export const SubmissionProcessingPlanSchema = z.object({
  noteType: z.enum(SUBMISSION_CONTENT_TYPES),
  mentions: z.array(SubmissionMentionPlanSchema),
  transitions: z.array(SubmissionTransitionPlanSchema),
  confidence: z.enum(CONFIDENCE_LEVELS),
  ambiguities: z.array(z.string()),
  /** When true, apply commits A→B and B→A as separate edges. */
  bidirectional: z.boolean(),
});
export type SubmissionProcessingPlan = z.infer<typeof SubmissionProcessingPlanSchema>;

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
