import { randomUUID } from "node:crypto";

import neo4j from "neo4j-driver";

import { readCypher } from "../cypher";
import { clampListLimit, clampListOffset, type ListPageMeta } from "../list-page";
import { asNamed, asTrack } from "../mappers";
import { normalizeName } from "../normalize";
import { asTransitionEdge, type TransitionEdgeSummary } from "../neighborhood";
import type { GraphNamedNode, GraphTrackNode } from "../types";
import { GraphWriteError } from "../types";
import { requireTrimmed, runWrite } from "./shared";

export type TransitionEndpointSummary = {
  track: GraphTrackNode;
  artists: GraphNamedNode[];
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

export type TransitionSortField = "updatedAt" | "createdAt";
export type TransitionSortOrder = "asc" | "desc";
/** `manual` = no sourceNoteId; `ai` = has sourceNoteId / proposalKey. */
export type TransitionSourceFilter = "manual" | "ai";

export type ListTransitionsInput = {
  /** Free-form match against endpoint titles/artists and transition notes. */
  query?: string;
  fromTrackId?: string;
  toTrackId?: string;
  technique?: string;
  intent?: string;
  quality?: string;
  sourceNoteId?: string;
  source?: TransitionSourceFilter;
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  sort?: TransitionSortField;
  order?: TransitionSortOrder;
  limit?: number;
  offset?: number;
};

export type ListTransitionsResult = {
  transitions: TransitionRecord[];
} & ListPageMeta;

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

type TransitionRow = {
  id: string;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
  fromArtists?: GraphNamedNode[];
  toArtists?: GraphNamedNode[];
  props: Record<string, unknown>;
};

function mapArtists(artists: GraphNamedNode[] | undefined): GraphNamedNode[] {
  return (artists ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null);
}

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
    from: { track: asTrack(row.from), artists: mapArtists(row.fromArtists) },
    to: { track: asTrack(row.to), artists: mapArtists(row.toArtists) },
    edge: asTransitionEdge({ ...row.props, id: row.id }),
  };
}

const TRANSITION_RETURN_AFTER_WRITE = `
  WITH from, to, t
  OPTIONAL MATCH (fa:Artist)-[:BY]->(from)
  OPTIONAL MATCH (ta:Artist)-[:BY]->(to)
  RETURN t.id AS id,
         from { .* } AS from,
         to { .* } AS to,
         collect(DISTINCT fa { .id, .name, .nameNormalized }) AS fromArtists,
         collect(DISTINCT ta { .id, .name, .nameNormalized }) AS toArtists,
         t { .* } AS props
`;

const TRANSITION_RETURN_AFTER_MATCH = `
  OPTIONAL MATCH (fa:Artist)-[:BY]->(from)
  OPTIONAL MATCH (ta:Artist)-[:BY]->(to)
  RETURN t.id AS id,
         from { .* } AS from,
         to { .* } AS to,
         collect(DISTINCT fa { .id, .name, .nameNormalized }) AS fromArtists,
         collect(DISTINCT ta { .id, .name, .nameNormalized }) AS toArtists,
         t { .* } AS props
`;

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

function mapTxRecord(record: { get: (key: string) => unknown }): TransitionRecord | null {
  return mapTransitionRow({
    id: record.get("id") as string,
    from: record.get("from") as Record<string, unknown>,
    to: record.get("to") as Record<string, unknown>,
    fromArtists: record.get("fromArtists") as GraphNamedNode[],
    toArtists: record.get("toArtists") as GraphNamedNode[],
    props: record.get("props") as Record<string, unknown>,
  });
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
      ${TRANSITION_RETURN_AFTER_WRITE}
      `,
      params,
    );

    const row = created.records[0];
    if (!row) {
      throw new GraphWriteError("invalid_input", "Failed to create transition.");
    }
    const mapped = mapTxRecord(row);
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
    ${TRANSITION_RETURN_AFTER_MATCH}
    `,
    { id: transitionId },
  );

  const row = rows[0];
  return row ? mapTransitionRow(row) : null;
}

function transitionOrderBy(sort: TransitionSortField, order: TransitionSortOrder): string {
  const dir = order === "asc" ? "ASC" : "DESC";
  const field = sort === "createdAt" ? "t.createdAt" : "t.updatedAt";
  return `coalesce(${field}, '') ${dir}, t.id ASC`;
}

/**
 * Library search/list for TRANSITION edges (DJ-72).
 * Endpoint filters are optional — omit them to browse the full transition set.
 */
export async function listTransitions(
  input: ListTransitionsInput = {},
): Promise<ListTransitionsResult> {
  const query = input.query?.trim() ?? "";
  const queryNormalized = query ? normalizeName(query) : "";
  const fromTrackId = input.fromTrackId?.trim() || null;
  const toTrackId = input.toTrackId?.trim() || null;
  const technique = input.technique?.trim() || null;
  const intent = input.intent?.trim() || null;
  const quality = input.quality?.trim() || null;
  const sourceNoteId = input.sourceNoteId?.trim() || null;
  const source = input.source === "manual" || input.source === "ai" ? input.source : null;
  const createdAfter = input.createdAfter?.trim() || null;
  const createdBefore = input.createdBefore?.trim() || null;
  const updatedAfter = input.updatedAfter?.trim() || null;
  const updatedBefore = input.updatedBefore?.trim() || null;
  const sort: TransitionSortField = input.sort === "createdAt" ? "createdAt" : "updatedAt";
  const order: TransitionSortOrder = input.order === "asc" ? "asc" : "desc";
  const limit = clampListLimit(input.limit);
  const offset = clampListOffset(input.offset);
  const fetchLimit = limit + 1;

  const rows = await readCypher<TransitionRow>(
    `
    MATCH (from:Track)-[t:TRANSITION]->(to:Track)
    OPTIONAL MATCH (fa:Artist)-[:BY]->(from)
    OPTIONAL MATCH (ta:Artist)-[:BY]->(to)
    WITH from, to, t,
         collect(DISTINCT fa) AS fromArtistNodes,
         collect(DISTINCT ta) AS toArtistNodes
    WHERE ($fromTrackId IS NULL OR from.id = $fromTrackId)
      AND ($toTrackId IS NULL OR to.id = $toTrackId)
      AND ($technique IS NULL OR toLower(coalesce(t.technique, '')) = toLower($technique))
      AND ($intent IS NULL OR toLower(coalesce(t.intent, '')) = toLower($intent))
      AND ($quality IS NULL OR toLower(coalesce(t.quality, '')) = toLower($quality))
      AND ($sourceNoteId IS NULL OR t.sourceNoteId = $sourceNoteId)
      AND (
        $source IS NULL OR
        ($source = 'manual' AND t.sourceNoteId IS NULL AND t.proposalKey IS NULL) OR
        ($source = 'ai' AND (t.sourceNoteId IS NOT NULL OR t.proposalKey IS NOT NULL))
      )
      AND ($createdAfter IS NULL OR coalesce(t.createdAt, '') >= $createdAfter)
      AND ($createdBefore IS NULL OR coalesce(t.createdAt, '') <= $createdBefore)
      AND ($updatedAfter IS NULL OR coalesce(t.updatedAt, '') >= $updatedAfter)
      AND ($updatedBefore IS NULL OR coalesce(t.updatedAt, '') <= $updatedBefore)
      AND (
        $queryNormalized = '' OR
        toLower(from.title) CONTAINS $queryNormalized OR
        toLower(to.title) CONTAINS $queryNormalized OR
        toLower(coalesce(t.notes, '')) CONTAINS $queryNormalized OR
        any(a IN fromArtistNodes WHERE toLower(a.name) CONTAINS $queryNormalized) OR
        any(a IN toArtistNodes WHERE toLower(a.name) CONTAINS $queryNormalized)
      )
    RETURN t.id AS id,
           from { .* } AS from,
           to { .* } AS to,
           [a IN fromArtistNodes WHERE a IS NOT NULL | a { .id, .name, .nameNormalized }] AS fromArtists,
           [a IN toArtistNodes WHERE a IS NOT NULL | a { .id, .name, .nameNormalized }] AS toArtists,
           t { .* } AS props
    ORDER BY ${transitionOrderBy(sort, order)}
    SKIP $offset
    LIMIT $limit
    `,
    {
      queryNormalized,
      fromTrackId,
      toTrackId,
      technique,
      intent,
      quality,
      sourceNoteId,
      source,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      offset: neo4j.int(offset),
      limit: neo4j.int(fetchLimit),
    },
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    transitions: page.map(mapTransitionRow).filter((row): row is TransitionRecord => row !== null),
    limit,
    offset,
    hasMore,
  };
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
      ${TRANSITION_RETURN_AFTER_WRITE}
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
    const mapped = mapTxRecord(row);
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
