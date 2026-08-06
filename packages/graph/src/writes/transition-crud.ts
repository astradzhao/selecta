import { randomUUID } from "node:crypto";

import neo4j from "neo4j-driver";

import { readCypher } from "../cypher";
import { asTrack } from "../mappers";
import { asTransitionEdge, type TransitionEdgeSummary } from "../neighborhood";
import type { GraphTrackNode } from "../types";
import { GraphWriteError } from "../types";
import { requireTrimmed, runWrite } from "./shared";

export type TransitionEndpointSummary = {
  track: GraphTrackNode;
};

export type TransitionRecord = {
  id: string;
  from: TransitionEndpointSummary;
  to: TransitionEndpointSummary;
  edge: TransitionEdgeSummary;
};

export type CreateTransitionInput = {
  fromTrackId: string;
  toTrackId: string;
  fromBar?: number | null;
  toBar?: number | null;
  barsOverlap?: number | null;
  technique?: string | null;
  intent?: string | null;
  quality?: string | null;
  notes?: string | null;
  /** Optional provenance for non-manual edges. */
  sourceNoteId?: string | null;
  sourceNoteVersion?: number | null;
  sourceProposalId?: string | null;
  confidence?: number | null;
};

export type UpdateTransitionInput = {
  fromBar?: number | null;
  toBar?: number | null;
  barsOverlap?: number | null;
  technique?: string | null;
  intent?: string | null;
  quality?: string | null;
  notes?: string | null;
};

export type ListTransitionsInput = {
  fromTrackId?: string;
  toTrackId?: string;
  limit?: number;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

function optionalNumber(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isFinite(value)) {
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

function clampListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(limit)));
}

type TransitionRow = {
  id: string;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
  props: Record<string, unknown>;
};

function mapTransitionRow(row: TransitionRow): TransitionRecord | null {
  if (typeof row.id !== "string" || !row.id.trim()) {
    return null;
  }
  if (!row.from?.id || typeof row.from.id !== "string") {
    return null;
  }
  if (!row.to?.id || typeof row.to.id !== "string") {
    return null;
  }
  return {
    id: row.id,
    from: { track: asTrack(row.from) },
    to: { track: asTrack(row.to) },
    edge: asTransitionEdge({ ...row.props, id: row.id }),
  };
}

async function assertTracksExist(
  tx: Parameters<Parameters<typeof runWrite>[0]>[0],
  fromTrackId: string,
  toTrackId: string,
): Promise<void> {
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
}

/**
 * Create a manual (or optionally provenance-tagged) TRANSITION with a new stable id.
 * Does not set proposalKey — AI commits use commitTransitionProposal.
 */
export async function createTransition(input: CreateTransitionInput): Promise<TransitionRecord> {
  const fromTrackId = requireTrimmed(input.fromTrackId, "fromTrackId");
  const toTrackId = requireTrimmed(input.toTrackId, "toTrackId");
  const id = randomUUID();
  const now = new Date().toISOString();

  const sourceNoteVersion =
    input.sourceNoteVersion === undefined || input.sourceNoteVersion === null
      ? null
      : input.sourceNoteVersion;
  if (
    sourceNoteVersion !== null &&
    (!Number.isInteger(sourceNoteVersion) || sourceNoteVersion < 0)
  ) {
    throw new GraphWriteError("invalid_input", "sourceNoteVersion must be a non-negative integer.");
  }

  const params = {
    id,
    fromTrackId,
    toTrackId,
    sourceNoteId: optionalString(input.sourceNoteId),
    sourceNoteVersion,
    sourceProposalId: optionalString(input.sourceProposalId),
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
    await assertTracksExist(tx, fromTrackId, toTrackId);

    const created = await tx.run(
      `
      MATCH (from:Track {id: $fromTrackId})
      MATCH (to:Track {id: $toTrackId})
      CREATE (from)-[t:TRANSITION {
        id: $id,
        sourceNoteId: $sourceNoteId,
        sourceNoteVersion: $sourceNoteVersion,
        sourceProposalId: $sourceProposalId,
        confidence: $confidence,
        fromBar: $fromBar,
        toBar: $toBar,
        barsOverlap: $barsOverlap,
        technique: $technique,
        intent: $intent,
        quality: $quality,
        notes: $notes,
        createdAt: $now,
        updatedAt: $now
      }]->(to)
      RETURN t.id AS id,
             from { .* } AS from,
             to { .* } AS to,
             t { .* } AS props
      `,
      params,
    );

    const row = created.records[0];
    if (!row) {
      throw new GraphWriteError("invalid_input", "Failed to create transition.");
    }
    const mapped = mapTransitionRow({
      id: row.get("id") as string,
      from: row.get("from") as Record<string, unknown>,
      to: row.get("to") as Record<string, unknown>,
      props: row.get("props") as Record<string, unknown>,
    });
    if (!mapped) {
      throw new GraphWriteError("invalid_input", "Created transition could not be mapped.");
    }
    return mapped;
  });
}

/** Fetch one TRANSITION by stable edge id, including endpoint track summaries. */
export async function getTransitionById(id: string): Promise<TransitionRecord | null> {
  const transitionId = id.trim();
  if (!transitionId) {
    return null;
  }

  const rows = await readCypher<TransitionRow>(
    `
    MATCH (from:Track)-[t:TRANSITION {id: $id}]->(to:Track)
    RETURN t.id AS id,
           from { .* } AS from,
           to { .* } AS to,
           t { .* } AS props
    LIMIT 1
    `,
    { id: transitionId },
  );

  const row = rows[0];
  return row ? mapTransitionRow(row) : null;
}

/**
 * List TRANSITION edges filtered by from and/or to track id.
 * At least one endpoint filter is required.
 */
export async function listTransitions(input: ListTransitionsInput): Promise<TransitionRecord[]> {
  const fromTrackId = input.fromTrackId?.trim() || null;
  const toTrackId = input.toTrackId?.trim() || null;
  if (!fromTrackId && !toTrackId) {
    throw new GraphWriteError(
      "invalid_input",
      "listTransitions requires fromTrackId and/or toTrackId.",
    );
  }

  const limit = clampListLimit(input.limit);
  const rows = await readCypher<TransitionRow>(
    `
    MATCH (from:Track)-[t:TRANSITION]->(to:Track)
    WHERE ($fromTrackId IS NULL OR from.id = $fromTrackId)
      AND ($toTrackId IS NULL OR to.id = $toTrackId)
    RETURN t.id AS id,
           from { .* } AS from,
           to { .* } AS to,
           t { .* } AS props
    ORDER BY coalesce(t.updatedAt, t.createdAt, '') DESC, t.id ASC
    LIMIT $limit
    `,
    { fromTrackId, toTrackId, limit: neo4j.int(limit) },
  );

  return rows.map(mapTransitionRow).filter((row): row is TransitionRecord => row !== null);
}

/**
 * Patch editable domain fields on one TRANSITION by id.
 * Does not change endpoints, id, or provenance keys.
 */
export async function updateTransitionById(
  id: string,
  input: UpdateTransitionInput,
): Promise<TransitionRecord> {
  const transitionId = requireTrimmed(id, "id");
  const now = new Date().toISOString();

  const hasPatch =
    input.fromBar !== undefined ||
    input.toBar !== undefined ||
    input.barsOverlap !== undefined ||
    input.technique !== undefined ||
    input.intent !== undefined ||
    input.quality !== undefined ||
    input.notes !== undefined;
  if (!hasPatch) {
    throw new GraphWriteError("invalid_input", "updateTransitionById requires at least one field.");
  }

  return runWrite(async (tx) => {
    const existing = await tx.run(
      `
      MATCH (from:Track)-[t:TRANSITION {id: $id}]->(to:Track)
      RETURN t { .* } AS props
      LIMIT 1
      `,
      { id: transitionId },
    );
    if (!existing.records[0]) {
      throw new GraphWriteError("not_found", `Transition "${transitionId}" was not found.`);
    }

    const updated = await tx.run(
      `
      MATCH (from:Track)-[t:TRANSITION {id: $id}]->(to:Track)
      SET
        t.fromBar = CASE WHEN $setFromBar THEN $fromBar ELSE t.fromBar END,
        t.toBar = CASE WHEN $setToBar THEN $toBar ELSE t.toBar END,
        t.barsOverlap = CASE WHEN $setBarsOverlap THEN $barsOverlap ELSE t.barsOverlap END,
        t.technique = CASE WHEN $setTechnique THEN $technique ELSE t.technique END,
        t.intent = CASE WHEN $setIntent THEN $intent ELSE t.intent END,
        t.quality = CASE WHEN $setQuality THEN $quality ELSE t.quality END,
        t.notes = CASE WHEN $setNotes THEN $notes ELSE t.notes END,
        t.updatedAt = $now
      RETURN t.id AS id,
             from { .* } AS from,
             to { .* } AS to,
             t { .* } AS props
      `,
      {
        id: transitionId,
        setFromBar: input.fromBar !== undefined,
        fromBar: optionalNumber(input.fromBar),
        setToBar: input.toBar !== undefined,
        toBar: optionalNumber(input.toBar),
        setBarsOverlap: input.barsOverlap !== undefined,
        barsOverlap: optionalNumber(input.barsOverlap),
        setTechnique: input.technique !== undefined,
        technique: optionalString(input.technique),
        setIntent: input.intent !== undefined,
        intent: optionalString(input.intent),
        setQuality: input.quality !== undefined,
        quality: optionalString(input.quality),
        setNotes: input.notes !== undefined,
        notes: optionalString(input.notes),
        now,
      },
    );

    const row = updated.records[0];
    if (!row) {
      throw new GraphWriteError("not_found", `Transition "${transitionId}" was not found.`);
    }
    const mapped = mapTransitionRow({
      id: row.get("id") as string,
      from: row.get("from") as Record<string, unknown>,
      to: row.get("to") as Record<string, unknown>,
      props: row.get("props") as Record<string, unknown>,
    });
    if (!mapped) {
      throw new GraphWriteError("invalid_input", "Updated transition could not be mapped.");
    }
    return mapped;
  });
}

/** Hard-delete exactly one TRANSITION by stable edge id. */
export async function deleteTransitionById(id: string): Promise<{ id: string; deleted: boolean }> {
  const transitionId = requireTrimmed(id, "id");

  return runWrite(async (tx) => {
    const result = await tx.run(
      `
      MATCH ()-[t:TRANSITION {id: $id}]->()
      WITH t, t.id AS id
      DELETE t
      RETURN id
      `,
      { id: transitionId },
    );
    const deletedId = result.records[0]?.get("id");
    if (typeof deletedId !== "string") {
      throw new GraphWriteError("not_found", `Transition "${transitionId}" was not found.`);
    }
    return { id: deletedId, deleted: true };
  });
}
