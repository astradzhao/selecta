/** NL parse / preview / commit orchestration + schemas (M3). */

import { EXTRACTION_PROMPT_VERSION } from "./extraction-prompt";

export {
  NOTE_TYPES,
  TRANSITION_QUALITIES,
  SongMentionSchema,
  TransitionProposalSchema,
  ExtractionProposalSchema,
  parseExtractionProposal,
  safeParseExtractionProposal,
  type NoteType,
  type TransitionQuality,
  type SongMention,
  type TransitionProposal,
  type ExtractionProposal,
} from "./extraction-schema";

export {
  EXTRACTION_PROMPT_VERSION,
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_PROMPT_EXAMPLES,
  getExtractionPromptMeta,
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  buildExtractionMessages,
  type ExtractionPromptMeta,
  type ExtractionPromptExample,
  type ExtractionPromptMessage,
} from "./extraction-prompt";

export {
  extractNoteProposals,
  hasTransitionProposals,
  providerFromModel,
  type ExtractNoteProposalsInput,
  type ExtractNoteProposalsResult,
} from "./extract-note";

export {
  CandidateHandleSchema,
  NoteMentionPlanSchema,
  NoteTransitionPlanSchema,
  NoteProcessingPlanSchema,
  NoteExtractionDraftSchema,
  draftToUnresolvedPlan,
  parseCandidateHandle,
  graphCandidateHandle,
  spotifyCandidateHandle,
  MENTION_RESOLUTION_STATUSES,
  type MentionResolutionStatus,
  type NoteMentionPlan,
  type NoteTransitionPlan,
  type NoteProcessingPlan,
  type NoteExtractionDraft,
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
  NOTE_AGENT_NAME,
  NOTE_AGENT_PROMPT_VERSION,
  buildNoteAgentPrompt,
  buildNoteAgentUserPrompt,
} from "./agent/prompt";

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

/** Reserved for future `@selecta/agentics` tool-loop agents; production path is durable orchestration. */
export { createNoteAgentTools } from "./agent/tools";
export { CandidateRegistry, withCandidateRegistry } from "./agent/candidate-registry";
export {
  evaluateNoteProcessingPolicy,
  type PolicyResult,
  type PolicyDecision,
  type PolicyGateCode,
  type EvaluatePolicyInput,
} from "./agent/policy";
export {
  evaluateProposalPolicy,
  proposalPolicyToPlanPolicy,
  type ProposalPolicyDecision,
  type ProposalPolicyResult,
  type EvaluateProposalPolicyInput,
} from "./agent/proposal-policy";
export {
  validateNoteProcessingPlan,
  type ValidatePlanInput,
  type ValidatePlanResult,
  type PlanValidationIssue,
} from "./agent/validate-plan";
export {
  applyNoteProcessingPolicy,
  type ApplyPolicyInput,
  type ApplyPolicyResult,
} from "./agent/apply-policy";
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
export { sourceFingerprint, spanProposalKey, legacyProposalKey } from "./agent/proposal-key";
export {
  SUBMISSION_LIMITS,
  utf8ByteLength,
  assertRawTextWithinLimit,
  type SubmissionLimits,
} from "./agent/limits";
export {
  runNoteAgent,
  DEFAULT_NOTE_AGENT_MODEL,
  type RunNoteAgentInput,
  type RunNoteAgentResult,
} from "./agent/run-note-agent";
export { createNoteAgent } from "./agent/index";

export function getMixNotesStatus() {
  return {
    configured: true as const,
    feature: "mix-notes" as const,
    promptVersion: EXTRACTION_PROMPT_VERSION,
  };
}
