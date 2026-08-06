/**
 * Centralized intake / orchestration guardrails (DJ-66).
 * Fail visibly when exceeded — never silently truncate.
 */
export const SUBMISSION_LIMITS = {
  /** Max raw submission size in UTF-8 bytes. */
  maxRawBytes: 64 * 1024,
  /** Max transitions the orchestrator may dispatch. */
  maxTransitions: 128,
  /** Max concurrent child parse steps. */
  maxConcurrentParses: 8,
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

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function assertRawTextWithinLimit(
  rawText: string,
  maxBytes: number = SUBMISSION_LIMITS.maxRawBytes,
): void {
  const bytes = utf8ByteLength(rawText);
  if (bytes > maxBytes) {
    throw new Error(
      `Submission exceeds max raw size (${bytes} bytes > ${maxBytes} bytes). Shorten the note and retry.`,
    );
  }
}
