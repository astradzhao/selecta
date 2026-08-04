import { z } from "zod";

import { NOTE_TYPES, TRANSITION_QUALITIES } from "../extraction-schema";

export const MENTION_RESOLUTION_STATUSES = [
  "resolved",
  "catalog_match",
  "ambiguous",
  "unresolved",
] as const;
export type MentionResolutionStatus = (typeof MENTION_RESOLUTION_STATUSES)[number];

const optionalNonNegInt = z.number().int().nonnegative().nullable().optional();
const optionalNonEmptyString = z.string().min(1).optional();

/** Opaque handles returned by tools: `graph:<id>` or `spotify:<providerId>`. */
export const CandidateHandleSchema = z
  .string()
  .regex(/^(graph|spotify):.+/, 'Candidate handle must be "graph:…" or "spotify:…"');

export const NoteMentionPlanSchema = z.object({
  mentionId: z.string().min(1),
  mention: z.string().min(1),
  titleHint: z.string().optional(),
  artistHint: z.string().optional(),
  selectedCandidateId: CandidateHandleSchema.nullable().optional(),
  resolutionStatus: z.enum(MENTION_RESOLUTION_STATUSES),
  confidence: z.number().min(0).max(1).optional(),
  ambiguityReason: z.string().optional(),
});
export type NoteMentionPlan = z.infer<typeof NoteMentionPlanSchema>;

export const NoteTransitionPlanSchema = z.object({
  fromMentionId: z.string().min(1),
  toMentionId: z.string().min(1),
  fromBar: optionalNonNegInt,
  toBar: optionalNonNegInt,
  barsOverlap: optionalNonNegInt,
  technique: optionalNonEmptyString,
  intent: optionalNonEmptyString,
  quality: z.enum(TRANSITION_QUALITIES).optional(),
  notes: z.string().optional(),
});
export type NoteTransitionPlan = z.infer<typeof NoteTransitionPlanSchema>;

export const NoteProcessingPlanSchema = z.object({
  noteType: z.enum(NOTE_TYPES),
  mentions: z.array(NoteMentionPlanSchema).default([]),
  transitions: z.array(NoteTransitionPlanSchema).default([]),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()).default([]),
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
