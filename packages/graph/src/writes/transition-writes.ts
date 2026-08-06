import { GraphWriteError } from "../types";
import { requireTrimmed, runWrite } from "./shared";

export type CommitTransitionInput = {
  fromTrackId: string;
  toTrackId: string;
  /** Deterministic idempotency key: noteId:extractionVersion:span:fingerprint */
  proposalKey: string;
  sourceNoteId: string;
  sourceNoteVersion: number;
  confidence?: number | null;
  fromBar?: number | null;
  toBar?: number | null;
  barsOverlap?: number | null;
  technique?: string | null;
  intent?: string | null;
  quality?: string | null;
  notes?: string | null;
};

export type CommitTransitionResult = {
  proposalKey: string;
  fromTrackId: string;
  toTrackId: string;
  created: boolean;
  properties: Record<string, unknown>;
};

function optionalNumber(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isFinite(value)) {
    // Models occasionally emit non-finite placeholders; treat as missing metadata.
    return null;
  }
  return value;
}

function optionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Idempotently MERGE a TRANSITION edge keyed by `proposalKey`.
 * Verifies both Track ids exist before writing.
 */
export async function commitTransitionProposal(
  input: CommitTransitionInput,
): Promise<CommitTransitionResult> {
  const fromTrackId = requireTrimmed(input.fromTrackId, "fromTrackId");
  const toTrackId = requireTrimmed(input.toTrackId, "toTrackId");
  const proposalKey = requireTrimmed(input.proposalKey, "proposalKey");
  const sourceNoteId = requireTrimmed(input.sourceNoteId, "sourceNoteId");
  if (!Number.isInteger(input.sourceNoteVersion) || input.sourceNoteVersion < 0) {
    throw new GraphWriteError("invalid_input", "sourceNoteVersion must be a non-negative integer.");
  }

  const now = new Date().toISOString();
  const props = {
    proposalKey,
    sourceNoteId,
    sourceNoteVersion: input.sourceNoteVersion,
    confidence: optionalNumber(input.confidence),
    fromBar: optionalNumber(input.fromBar),
    toBar: optionalNumber(input.toBar),
    barsOverlap: optionalNumber(input.barsOverlap),
    technique: optionalString(input.technique),
    intent: optionalString(input.intent),
    quality: optionalString(input.quality),
    notes: optionalString(input.notes),
    now,
  };

  return runWrite(async (tx) => {
    const endpoints = await tx.run(
      `
      OPTIONAL MATCH (from:Track {id: $fromTrackId})
      OPTIONAL MATCH (to:Track {id: $toTrackId})
      RETURN from IS NOT NULL AS fromOk, to IS NOT NULL AS toOk
      `,
      { fromTrackId, toTrackId },
    );
    const row = endpoints.records[0];
    if (!row?.get("fromOk")) {
      throw new GraphWriteError("not_found", `fromTrackId "${fromTrackId}" was not found.`);
    }
    if (!row?.get("toOk")) {
      throw new GraphWriteError("not_found", `toTrackId "${toTrackId}" was not found.`);
    }

    const existing = await tx.run(
      `
      MATCH (:Track)-[t:TRANSITION {proposalKey: $proposalKey}]->(:Track)
      RETURN t { .* } AS props
      LIMIT 1
      `,
      { proposalKey },
    );
    if (existing.records[0]) {
      return {
        proposalKey,
        fromTrackId,
        toTrackId,
        created: false,
        properties: existing.records[0].get("props") as Record<string, unknown>,
      };
    }

    const created = await tx.run(
      `
      MATCH (from:Track {id: $fromTrackId})
      MATCH (to:Track {id: $toTrackId})
      MERGE (from)-[t:TRANSITION {proposalKey: $proposalKey}]->(to)
      ON CREATE SET
        t.sourceNoteId = $sourceNoteId,
        t.sourceNoteVersion = $sourceNoteVersion,
        t.confidence = $confidence,
        t.fromBar = $fromBar,
        t.toBar = $toBar,
        t.barsOverlap = $barsOverlap,
        t.technique = $technique,
        t.intent = $intent,
        t.quality = $quality,
        t.notes = $notes,
        t.createdAt = $now,
        t.updatedAt = $now
      ON MATCH SET
        t.updatedAt = $now
      RETURN t { .* } AS props
      `,
      { fromTrackId, toTrackId, ...props },
    );

    return {
      proposalKey,
      fromTrackId,
      toTrackId,
      created: true,
      properties: (created.records[0]?.get("props") ?? {}) as Record<string, unknown>,
    };
  });
}

/** Commit multiple transitions in one write transaction (sequential MERGEs). */
export async function commitTransitionProposals(
  inputs: CommitTransitionInput[],
): Promise<CommitTransitionResult[]> {
  const results: CommitTransitionResult[] = [];
  for (const input of inputs) {
    results.push(await commitTransitionProposal(input));
  }
  return results;
}
