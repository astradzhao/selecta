/** Deterministic resolve / decide / apply pipeline for extracted submissions. */

export {
  TrackCandidateSchema,
  SearchQueriesInputSchema,
  SearchCandidatesOutputSchema,
  type TrackCandidate,
  type SearchQueriesInput,
  type SearchCandidatesOutput,
  type CandidateSearchPort,
  type MusicWritePort,
  type SubmissionAgentServices,
} from "./ports";

export { CandidateRegistry } from "./candidate-registry";
export {
  mentionSearchQuery,
  mentionSpotifySearchQuery,
  stripCueSuffixesFromSearchQuery,
  topSearchHit,
} from "./match";
export { type PolicyGateCode, type PolicyImportAction, type PolicyCommitAction } from "./policy";
export {
  evaluateProposalPolicy,
  type ProposalPolicyDecision,
  type ProposalPolicyResult,
  type EvaluateProposalPolicyInput,
} from "./proposal-policy";
export {
  applyProposalPolicy,
  type ApplyProposalPolicyInput,
  type ApplyProposalPolicyResult,
} from "./apply-proposal-policy";
export {
  buildReviewerPolicyResult,
  assertReviewerEndpoint,
  type ReviewerEndpoint,
  type BuildReviewerPolicyResultInput,
} from "./reviewer-policy";
export {
  resolveProposalsBatch,
  type ProposalResolveItem,
  type ResolveProposalsBatchInput,
  type ResolveProposalsBatchResult,
  type ResolvedProposalItem,
} from "./resolve-proposals-batch";
export { sourceFingerprint, spanProposalKey } from "./proposal-key";
