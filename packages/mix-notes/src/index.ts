/** NL parse / preview / commit orchestration + schemas (M3). */

import { ORCHESTRATOR_PROMPT_VERSION } from "./agent/orchestrator-prompt";

export {
  NOTE_TYPES,
  TRANSITION_QUALITIES,
  type NoteType,
  type TransitionQuality,
} from "./note-types";

export {
  CONFIDENCE_LEVELS,
  AUTO_COMMIT_CONFIDENCE_FLOOR,
  confidenceOrdinal,
  confidenceToUnitInterval,
  meetsAutoCommitConfidence,
  type ConfidenceLevel,
} from "./agent/confidence";

export {
  CandidateHandleSchema,
  NoteMentionPlanSchema,
  NoteTransitionPlanSchema,
  NoteProcessingPlanSchema,
  parseCandidateHandle,
  graphCandidateHandle,
  spotifyCandidateHandle,
  MENTION_RESOLUTION_STATUSES,
  type MentionResolutionStatus,
  type NoteMentionPlan,
  type NoteTransitionPlan,
  type NoteProcessingPlan,
} from "./agent/schema";

export {
  SingleTransitionDraftSchema,
  ParseSingleTransitionReceiptSchema,
  ParseSingleTransitionInputSchema,
  draftToSingleUnresolvedPlan,
  OrchestratorFinishSchema,
  type SingleTransitionDraft,
  type ParseSingleTransitionReceipt,
  type ParseSingleTransitionInput,
  type OrchestratorFinish,
} from "./agent/single-transition-schema";

export {
  ORCHESTRATOR_AGENT_NAME,
  ORCHESTRATOR_PROMPT_VERSION,
  SINGLE_TRANSITION_PROMPT_VERSION,
  DEFAULT_ORCHESTRATOR_MODEL,
  DEFAULT_SINGLE_TRANSITION_MODEL,
  buildOrchestratorPrompt,
  buildOrchestratorUserPrompt,
  buildSingleTransitionPrompt,
  buildSingleTransitionUserPrompt,
} from "./agent/orchestrator-prompt";

export {
  TrackCandidateSchema,
  SearchQueriesInputSchema,
  SearchCandidatesOutputSchema,
  type TrackCandidate,
  type SearchQueriesInput,
  type SearchCandidatesOutput,
  type NoteAgentServices,
} from "./agent/services";

export { CandidateRegistry, withCandidateRegistry } from "./agent/candidate-registry";
export {
  type PolicyGateCode,
  type PolicyImportAction,
  type PolicyCommitAction,
} from "./agent/policy";
export {
  evaluateProposalPolicy,
  type ProposalPolicyDecision,
  type ProposalPolicyResult,
  type EvaluateProposalPolicyInput,
} from "./agent/proposal-policy";
export {
  applyProposalPolicy,
  type ApplyProposalPolicyInput,
  type ApplyProposalPolicyResult,
} from "./agent/apply-proposal-policy";
export {
  resolveNoteMentions,
  type ResolveMentionsInput,
  type ResolveMentionsResult,
} from "./agent/resolve-mentions";
export {
  resolveProposalsBatch,
  type ProposalResolveItem,
  type ResolveProposalsBatchInput,
  type ResolveProposalsBatchResult,
  type ResolvedProposalItem,
} from "./agent/resolve-proposals-batch";
export {
  parseSingleTransitionDraft,
  type ParseSingleTransitionDraftInput,
  type ParseSingleTransitionDraftResult,
} from "./agent/parse-single-transition";
export { sourceFingerprint, spanProposalKey } from "./agent/proposal-key";
export {
  SUBMISSION_LIMITS,
  utf8ByteLength,
  assertRawTextWithinLimit,
  type SubmissionLimits,
} from "./agent/limits";
export { providerFromModel } from "./agent/provider";

export function getMixNotesStatus() {
  return {
    configured: true as const,
    feature: "mix-notes" as const,
    promptVersion: ORCHESTRATOR_PROMPT_VERSION,
  };
}
