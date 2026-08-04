import { parseCandidateHandle, type NoteProcessingPlan } from "./schema";
import type { TrackCandidate } from "./services";

export type PlanValidationIssue = {
  code:
    | "duplicate_mention_id"
    | "unknown_candidate"
    | "invalid_endpoint"
    | "unsupported_handle"
    | "too_many_transitions"
    | "too_many_mentions"
    | "stale_version"
    | "out_of_range";
  message: string;
};

export type ValidatePlanInput = {
  plan: NoteProcessingPlan;
  candidatesByHandle: Map<string, TrackCandidate>;
  expectedExtractionVersion?: number;
  actualExtractionVersion?: number;
  maxMentions?: number;
  maxTransitions?: number;
};

export type ValidatePlanResult =
  | { ok: true; plan: NoteProcessingPlan }
  | { ok: false; issues: PlanValidationIssue[] };

/**
 * Reject invented handles, broken endpoint refs, and oversized plans before policy.
 */
export function validateNoteProcessingPlan(input: ValidatePlanInput): ValidatePlanResult {
  const issues: PlanValidationIssue[] = [];
  const maxMentions = input.maxMentions ?? 8;
  const maxTransitions = input.maxTransitions ?? 4;
  const { plan, candidatesByHandle } = input;

  if (
    input.expectedExtractionVersion !== undefined &&
    input.actualExtractionVersion !== undefined &&
    input.expectedExtractionVersion !== input.actualExtractionVersion
  ) {
    issues.push({
      code: "stale_version",
      message: `Stale extraction version ${input.expectedExtractionVersion}; current is ${input.actualExtractionVersion}.`,
    });
  }

  if (plan.mentions.length > maxMentions) {
    issues.push({
      code: "too_many_mentions",
      message: `Plan has ${plan.mentions.length} mentions; max is ${maxMentions}.`,
    });
  }

  if (plan.transitions.length > maxTransitions) {
    issues.push({
      code: "too_many_transitions",
      message: `Plan has ${plan.transitions.length} transitions; max is ${maxTransitions}.`,
    });
  }

  if (plan.confidence < 0 || plan.confidence > 1) {
    issues.push({
      code: "out_of_range",
      message: "confidence must be between 0 and 1.",
    });
  }

  const seenMentionIds = new Set<string>();
  for (const mention of plan.mentions) {
    if (seenMentionIds.has(mention.mentionId)) {
      issues.push({
        code: "duplicate_mention_id",
        message: `Duplicate mentionId "${mention.mentionId}".`,
      });
    }
    seenMentionIds.add(mention.mentionId);

    const handle = mention.selectedCandidateId ?? null;
    if (!handle) {
      continue;
    }
    const parsed = parseCandidateHandle(handle);
    if (!parsed) {
      issues.push({
        code: "unsupported_handle",
        message: `Unsupported candidate handle "${handle}".`,
      });
      continue;
    }
    if (!candidatesByHandle.has(handle)) {
      issues.push({
        code: "unknown_candidate",
        message: `selectedCandidateId "${handle}" was not returned by tools in this run.`,
      });
    }
  }

  for (const [index, transition] of plan.transitions.entries()) {
    if (!seenMentionIds.has(transition.fromMentionId)) {
      issues.push({
        code: "invalid_endpoint",
        message: `Transition ${index} fromMentionId "${transition.fromMentionId}" is unknown.`,
      });
    }
    if (!seenMentionIds.has(transition.toMentionId)) {
      issues.push({
        code: "invalid_endpoint",
        message: `Transition ${index} toMentionId "${transition.toMentionId}" is unknown.`,
      });
    }
    if (
      transition.fromBar != null &&
      transition.toBar != null &&
      transition.toBar < transition.fromBar
    ) {
      issues.push({
        code: "out_of_range",
        message: `Transition ${index} has toBar < fromBar.`,
      });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, plan };
}
