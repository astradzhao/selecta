import { createHash } from "node:crypto";

/**
 * Stable content fingerprint for a source span.
 * Used so agent resegmentation / ordinal shuffle does not duplicate proposals.
 */
export function sourceFingerprint(
  sourceStart: number,
  sourceEnd: number,
  sourceText: string,
): string {
  const normalized = sourceText.replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update(`${sourceStart}:${sourceEnd}:${normalized}`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Durable proposal identity for Neo4j MERGE + Postgres unique constraint.
 * Format: `{submissionId}:{extractionVersion}:span:{fingerprint}`
 */
export function spanProposalKey(
  submissionId: string,
  extractionVersion: number,
  fingerprint: string,
): string {
  return `${submissionId}:${extractionVersion}:span:${fingerprint}`;
}

/**
 * Legacy key used by DJ-64 one-shot commits.
 * Retained for compatibility with already-committed Neo4j edges.
 */
export function legacyProposalKey(
  noteId: string,
  extractionVersion: number,
  transitionIndex: number,
): string {
  return `${noteId}:${extractionVersion}:${transitionIndex}`;
}
