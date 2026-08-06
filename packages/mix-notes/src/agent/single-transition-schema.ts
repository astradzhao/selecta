import { z } from "zod";

import { NOTE_TYPES, TRANSITION_QUALITIES } from "../extraction-schema";
import { MENTION_RESOLUTION_STATUSES, NoteTransitionPlanSchema } from "./schema";

/**
 * OpenAI structured outputs require every `properties` key to appear in `required`.
 * Represent "missing" values as `null` — never Zod `.optional()`.
 */
const nullableNonEmptyString = z.string().min(1).nullable();
const nullableString = z.string().nullable();
const nullableConfidence = z.number().min(0).max(1).nullable();

/**
 * Cheap one-transition child draft. Exactly one transition; resolver fills candidates later.
 */
export const SingleTransitionDraftSchema = z.object({
  noteType: z.enum(NOTE_TYPES),
  mentions: z
    .array(
      z.object({
        mentionId: z.string().min(1),
        mention: z.string().min(1),
        titleHint: nullableString,
        artistHint: nullableString,
        confidence: nullableConfidence,
        ambiguityReason: nullableString,
      }),
    )
    .min(1)
    .max(4),
  transition: NoteTransitionPlanSchema,
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()),
});
export type SingleTransitionDraft = z.infer<typeof SingleTransitionDraftSchema>;

/** Tool receipt returned to the parent orchestrator — never the full child JSON. */
export const ParseSingleTransitionReceiptSchema = z.object({
  ok: z.boolean(),
  proposalId: z.string().nullable(),
  retryable: z.boolean(),
  error: nullableString,
});
export type ParseSingleTransitionReceipt = z.infer<typeof ParseSingleTransitionReceiptSchema>;

export const ParseSingleTransitionInputSchema = z.object({
  submissionId: z.string().min(1),
  extractionVersion: z.number().int().nonnegative(),
  ordinal: z.number().int().nonnegative(),
  sourceStart: z.number().int().nonnegative(),
  sourceEnd: z.number().int().nonnegative(),
  sourceText: z.string().min(1),
  sourceFingerprint: z.string().min(1).optional(),
});
export type ParseSingleTransitionInput = z.infer<typeof ParseSingleTransitionInputSchema>;

export function draftToSingleUnresolvedPlan(draft: SingleTransitionDraft) {
  return {
    noteType: draft.noteType,
    confidence: draft.confidence,
    ambiguities: draft.ambiguities,
    transitions: [draft.transition],
    mentions: draft.mentions.map((mention) => ({
      ...mention,
      selectedCandidateId: null as string | null,
      resolutionStatus: "unresolved" as (typeof MENTION_RESOLUTION_STATUSES)[number],
    })),
  };
}

/** Orchestrator output when finishing without structured spans (spans come from tool calls). */
export const OrchestratorFinishSchema = z.object({
  transitionCount: z.number().int().nonnegative(),
  notes: nullableNonEmptyString,
});
export type OrchestratorFinish = z.infer<typeof OrchestratorFinishSchema>;
