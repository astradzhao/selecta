/** Submission NL parse / preview / commit orchestration + schemas. */

export { SUBMISSION_CONTENT_TYPES, type SubmissionContentType } from "./content-types";

export {
  CONFIDENCE_LEVELS,
  AUTO_COMMIT_CONFIDENCE_FLOOR,
  confidenceOrdinal,
  confidenceToUnitInterval,
  type ConfidenceLevel,
} from "./agent/confidence";

export {
  CandidateHandleSchema,
  SubmissionMentionPlanSchema,
  SubmissionTransitionPlanSchema,
  SubmissionProcessingPlanSchema,
  parseCandidateHandle,
  graphCandidateHandle,
  spotifyCandidateHandle,
  MENTION_RESOLUTION_STATUSES,
  type MentionResolutionStatus,
  type SubmissionMentionPlan,
  type SubmissionTransitionPlan,
  type SubmissionProcessingPlan,
} from "./agent/schema";

export {
  SingleTransitionDraftSchema,
  ParseSingleTransitionReceiptSchema,
  ParseSingleTransitionInputSchema,
  draftToSingleUnresolvedPlan,
  type SingleTransitionDraft,
  type ParseSingleTransitionReceipt,
  type ParseSingleTransitionInput,
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
  type SubmissionAgentServices,
} from "./agent/services";

export { CandidateRegistry } from "./agent/candidate-registry";
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
  buildReviewerPolicyResult,
  assertReviewerEndpoint,
  type ReviewerEndpoint,
  type BuildReviewerPolicyResultInput,
} from "./agent/reviewer-policy";
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
export { SUBMISSION_LIMITS, type SubmissionLimits } from "./agent/limits";
export { providerFromModel } from "./agent/provider";
