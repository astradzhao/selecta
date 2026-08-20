import { z } from "zod";

import { SUBMISSION_CONTENT_TYPES } from "./content-types";
import { CONFIDENCE_LEVELS } from "./confidence";
import { MENTION_RESOLUTION_STATUSES, SubmissionTransitionPlanSchema } from "./schema";

/**
 * OpenAI structured outputs require every `properties` key to appear in `required`.
 * Represent "missing" values as `null` — never Zod `.optional()`.
 */
const nullableString = z.string().nullable();
const nullableConfidence = z.number().min(0).max(1).nullable();

/**
 * Cheap one-transition child draft. Exactly one transition; resolver fills candidates later.
 */
export const SingleTransitionDraftSchema = z.object({
  noteType: z.enum(SUBMISSION_CONTENT_TYPES),
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
    .min(2)
    .max(2),
  transition: SubmissionTransitionPlanSchema,
  /**
   * True when the span is an unordered pair (e.g. "A, B" / "A & B") and both
   * directions should be committed as separate edges.
   */
  bidirectional: z.boolean(),
  confidence: z.enum(CONFIDENCE_LEVELS),
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
  sourceStart: z.number().int().nonnegative(),
  sourceEnd: z.number().int().nonnegative(),
  sourceText: z.string().min(1),
  /** Ignored if provided — fingerprint is always computed server-side. */
  sourceFingerprint: z.string().min(1).optional(),
});
export type ParseSingleTransitionInput = z.infer<typeof ParseSingleTransitionInputSchema>;

export function draftToSingleUnresolvedPlan(draft: SingleTransitionDraft) {
  return {
    noteType: draft.noteType,
    confidence: draft.confidence,
    ambiguities: draft.ambiguities,
    bidirectional: draft.bidirectional === true,
    transitions: [draft.transition],
    mentions: draft.mentions.map((mention) => ({
      ...mention,
      selectedCandidateId: null as string | null,
      resolutionStatus: "unresolved" as (typeof MENTION_RESOLUTION_STATUSES)[number],
    })),
  };
}
