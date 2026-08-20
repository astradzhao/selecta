/**
 * Centralized intake / orchestration guardrails (DJ-66).
 * Fail visibly when exceeded — never silently truncate.
 */
export const SUBMISSION_LIMITS = {
  /** Max transitions the orchestrator may dispatch. */
  maxTransitions: 128,
  /** Transient child step retries (runtime-owned; not LLM redispatches). */
  maxChildRetries: 2,
  /** Bounded orchestration model steps (tool rounds + finish). */
  maxOrchestrationSteps: 32,
  /** Mentions resolved per search batch chunk. */
  resolveBatchSize: 16,
  /** Per-proposal import cap. */
  maxImportsPerProposal: 2,
} as const;

export type SubmissionLimits = typeof SUBMISSION_LIMITS;
