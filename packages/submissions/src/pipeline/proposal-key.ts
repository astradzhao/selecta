import { createHash } from "node:crypto";

/**
 * Stable content fingerprint for a source span.
 * Offsets are ignored so slight resegmentation of the same text does not
 * create duplicate proposals within a version.
 */
export function sourceFingerprint(
  _sourceStart: number,
  _sourceEnd: number,
  sourceText: string,
): string {
  const normalized = sourceText.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

/**
 * Durable proposal identity for the Postgres unique constraint.
 * Format: `{submissionId}:{extractionVersion}:span:{fingerprint}`
 */
export function spanProposalKey(
  submissionId: string,
  extractionVersion: number,
  fingerprint: string,
): string {
  return `${submissionId}:${extractionVersion}:span:${fingerprint}`;
}
