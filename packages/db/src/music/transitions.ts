import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

import { getExecutor } from "../executor";
import {
  artists,
  noteProposals,
  trackArtists,
  trackExternalIds,
  tracks,
  transitions,
  type NoteProposalStatus,
  type Track,
  type TransitionRow,
} from "../schema";
import { MusicWriteError } from "./errors";
import { clampListLimit, clampListOffset, type ListPageMeta } from "./list-page";
import { toNamedNode, toTrackNode } from "./mappers";
import { normalizeName } from "./normalize";
import { asTransitionEdge, transitionRowToEdge, type TransitionEdgeSummary } from "./neighborhood";
import { optionalNumber, optionalString, requireTrimmed } from "./shared";
import type { NamedNode, TrackNode } from "./types";

export type TransitionEndpointSummary = {
  track: TrackNode;
  artists: NamedNode[];
};

export type TransitionRecord = {
  id: string;
  from: TransitionEndpointSummary;
  to: TransitionEndpointSummary;
  edge: TransitionEdgeSummary;
};

/** Review enrichment from note_proposals (LEFT JOIN on source_proposal_id). */
export type TransitionProposalReview = {
  id: string;
  status: NoteProposalStatus;
  proposalKey: string;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
};

export type TransitionListItem = TransitionRecord & {
  proposal: TransitionProposalReview | null;
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
/** `manual` = no sourceNoteId and no proposalKey; `ai` = either set. */
export type TransitionSourceFilter = "manual" | "ai";

export type ListTransitionsInput = {
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
  /** When true (default), LEFT JOIN note_proposals for Library review enrichment. */
  includeProposal?: boolean;
};

export type ListTransitionsResult = {
  transitions: TransitionListItem[];
} & ListPageMeta;

export type CommitTransitionInput = {
  fromTrackId: string;
  toTrackId: string;
  /** Deterministic idempotency key: noteId:extractionVersion:span:fingerprint */
  proposalKey: string;
  sourceNoteId: string;
  sourceNoteVersion: number;
  /** Postgres note_proposals.id when committing from the agent pipeline. */
  sourceProposalId?: string | null;
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
  id: string | null;
  proposalKey: string;
  fromTrackId: string;
  toTrackId: string;
  created: boolean;
  properties: Record<string, unknown>;
};

const fromTracks = alias(tracks, "from_tracks");
const toTracks = alias(tracks, "to_tracks");

async function assertTracksExist(fromTrackId: string, toTrackId: string): Promise<void> {
  const rows = await getExecutor()
    .select({ id: tracks.id })
    .from(tracks)
    .where(inArray(tracks.id, [fromTrackId, toTrackId]));
  const ids = new Set(rows.map((row) => row.id));
  if (!ids.has(fromTrackId)) {
    throw new MusicWriteError("not_found", `fromTrackId "${fromTrackId}" was not found.`);
  }
  if (!ids.has(toTrackId)) {
    throw new MusicWriteError("not_found", `toTrackId "${toTrackId}" was not found.`);
  }
}

async function loadExternalIdMaps(
  trackIds: string[],
): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  if (trackIds.length === 0) {
    return map;
  }
  const rows = await getExecutor()
    .select()
    .from(trackExternalIds)
    .where(inArray(trackExternalIds.trackId, trackIds));
  for (const row of rows) {
    const existing = map.get(row.trackId) ?? {};
    existing[row.provider] = row.providerId;
    map.set(row.trackId, existing);
  }
  return map;
}

async function loadArtistsByTrackIds(trackIds: string[]): Promise<Map<string, NamedNode[]>> {
  const map = new Map<string, NamedNode[]>();
  if (trackIds.length === 0) {
    return map;
  }
  const rows = await getExecutor()
    .select({
      trackId: trackArtists.trackId,
      id: artists.id,
      name: artists.name,
      nameNormalized: artists.nameNormalized,
    })
    .from(trackArtists)
    .innerJoin(artists, eq(trackArtists.artistId, artists.id))
    .where(inArray(trackArtists.trackId, trackIds));
  for (const row of rows) {
    const list = map.get(row.trackId) ?? [];
    list.push(toNamedNode(row));
    map.set(row.trackId, list);
  }
  return map;
}

function toEndpoint(
  track: Track,
  artistsByTrack: Map<string, NamedNode[]>,
  extMaps: Map<string, Record<string, string>>,
): TransitionEndpointSummary {
  return {
    track: toTrackNode(track, extMaps.get(track.id) ?? {}),
    artists: artistsByTrack.get(track.id) ?? [],
  };
}

async function hydrateTransitionRecords(
  edgeRows: TransitionRow[],
  fromRows: Track[],
  toRows: Track[],
): Promise<TransitionRecord[]> {
  if (edgeRows.length === 0) {
    return [];
  }
  const fromById = new Map(fromRows.map((row) => [row.id, row]));
  const toById = new Map(toRows.map((row) => [row.id, row]));
  const trackIds = [
    ...new Set([...edgeRows.map((e) => e.fromTrackId), ...edgeRows.map((e) => e.toTrackId)]),
  ];
  const [artistsByTrack, extMaps] = await Promise.all([
    loadArtistsByTrackIds(trackIds),
    loadExternalIdMaps(trackIds),
  ]);

  const records: TransitionRecord[] = [];
  for (const edge of edgeRows) {
    const from = fromById.get(edge.fromTrackId);
    const to = toById.get(edge.toTrackId);
    if (!from || !to) {
      continue;
    }
    records.push({
      id: edge.id,
      from: toEndpoint(from, artistsByTrack, extMaps),
      to: toEndpoint(to, artistsByTrack, extMaps),
      edge: transitionRowToEdge(edge),
    });
  }
  return records;
}

async function loadTransitionRecord(id: string): Promise<TransitionRecord | null> {
  const [row] = await getExecutor()
    .select({
      edge: transitions,
      from: fromTracks,
      to: toTracks,
    })
    .from(transitions)
    .innerJoin(fromTracks, eq(transitions.fromTrackId, fromTracks.id))
    .innerJoin(toTracks, eq(transitions.toTrackId, toTracks.id))
    .where(eq(transitions.id, id))
    .limit(1);

  if (!row) {
    return null;
  }
  const [record] = await hydrateTransitionRecords([row.edge], [row.from], [row.to]);
  return record ?? null;
}

function transitionProperties(row: TransitionRow): Record<string, unknown> {
  return {
    id: row.id,
    proposalKey: row.proposalKey,
    sourceNoteId: row.sourceNoteId,
    sourceNoteVersion: row.sourceNoteVersion,
    sourceProposalId: row.sourceProposalId,
    confidence: row.confidence,
    fromBar: row.fromBar,
    toBar: row.toBar,
    barsOverlap: row.barsOverlap,
    technique: row.technique,
    intent: row.intent,
    quality: row.quality,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    fromTrackId: row.fromTrackId,
    toTrackId: row.toTrackId,
  };
}

/**
 * Create a manual (or optionally provenance-tagged) transition with a new stable id.
 * Does not set proposalKey — AI commits use commitTransitionProposal.
 */
export async function createTransition(input: CreateTransitionInput): Promise<TransitionRecord> {
  const fromTrackId = requireTrimmed(input.fromTrackId, "fromTrackId");
  const toTrackId = requireTrimmed(input.toTrackId, "toTrackId");
  const sourceNoteVersion =
    input.sourceNoteVersion === undefined || input.sourceNoteVersion === null
      ? null
      : input.sourceNoteVersion;
  if (
    sourceNoteVersion !== null &&
    (!Number.isInteger(sourceNoteVersion) || sourceNoteVersion < 0)
  ) {
    throw new MusicWriteError("invalid_input", "sourceNoteVersion must be a non-negative integer.");
  }

  await assertTracksExist(fromTrackId, toTrackId);

  const id = randomUUID();
  await getExecutor()
    .insert(transitions)
    .values({
      id,
      fromTrackId,
      toTrackId,
      proposalKey: null,
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
    });

  const record = await loadTransitionRecord(id);
  if (!record) {
    throw new MusicWriteError("invalid_input", "Failed to create transition.");
  }
  return record;
}

/** Fetch one transition by stable edge id, including endpoint track summaries. */
export async function getTransitionById(id: string): Promise<TransitionRecord | null> {
  const transitionId = id.trim();
  if (!transitionId) {
    return null;
  }
  return loadTransitionRecord(transitionId);
}

function parseBound(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Library search/list for transitions.
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
  const createdAfter = parseBound(input.createdAfter?.trim() || null);
  const createdBefore = parseBound(input.createdBefore?.trim() || null);
  const updatedAfter = parseBound(input.updatedAfter?.trim() || null);
  const updatedBefore = parseBound(input.updatedBefore?.trim() || null);
  const sort: TransitionSortField = input.sort === "createdAt" ? "createdAt" : "updatedAt";
  const order: TransitionSortOrder = input.order === "asc" ? "asc" : "desc";
  const limit = clampListLimit(input.limit);
  const offset = clampListOffset(input.offset);
  const fetchLimit = limit + 1;
  const includeProposal = input.includeProposal !== false;

  const parts: SQL[] = [];
  if (fromTrackId) {
    parts.push(eq(transitions.fromTrackId, fromTrackId));
  }
  if (toTrackId) {
    parts.push(eq(transitions.toTrackId, toTrackId));
  }
  if (technique) {
    parts.push(sql`lower(coalesce(${transitions.technique}, '')) = lower(${technique})`);
  }
  if (intent) {
    parts.push(sql`lower(coalesce(${transitions.intent}, '')) = lower(${intent})`);
  }
  if (quality) {
    parts.push(sql`lower(coalesce(${transitions.quality}, '')) = lower(${quality})`);
  }
  if (sourceNoteId) {
    parts.push(eq(transitions.sourceNoteId, sourceNoteId));
  }
  if (source === "manual") {
    parts.push(and(isNull(transitions.proposalKey), isNull(transitions.sourceNoteId))!);
  } else if (source === "ai") {
    parts.push(or(isNotNull(transitions.proposalKey), isNotNull(transitions.sourceNoteId))!);
  }
  if (createdAfter) {
    parts.push(gte(transitions.createdAt, createdAfter));
  }
  if (createdBefore) {
    parts.push(lte(transitions.createdAt, createdBefore));
  }
  if (updatedAfter) {
    parts.push(gte(transitions.updatedAt, updatedAfter));
  }
  if (updatedBefore) {
    parts.push(lte(transitions.updatedAt, updatedBefore));
  }
  if (queryNormalized) {
    const pattern = `%${queryNormalized}%`;
    parts.push(
      or(
        sql`lower(${fromTracks.title}) like ${pattern}`,
        sql`lower(${toTracks.title}) like ${pattern}`,
        sql`lower(coalesce(${transitions.notes}, '')) like ${pattern}`,
        exists(
          getExecutor()
            .select({ one: sql`1` })
            .from(trackArtists)
            .innerJoin(artists, eq(trackArtists.artistId, artists.id))
            .where(
              and(
                eq(trackArtists.trackId, transitions.fromTrackId),
                sql`lower(${artists.name}) like ${pattern}`,
              ),
            ),
        ),
        exists(
          getExecutor()
            .select({ one: sql`1` })
            .from(trackArtists)
            .innerJoin(artists, eq(trackArtists.artistId, artists.id))
            .where(
              and(
                eq(trackArtists.trackId, transitions.toTrackId),
                sql`lower(${artists.name}) like ${pattern}`,
              ),
            ),
        ),
      )!,
    );
  }

  const where = parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : and(...parts);
  const sortCol = sort === "createdAt" ? transitions.createdAt : transitions.updatedAt;
  const orderBy =
    order === "asc" ? [asc(sortCol), asc(transitions.id)] : [desc(sortCol), asc(transitions.id)];

  const baseQuery = getExecutor()
    .select({
      edge: transitions,
      from: fromTracks,
      to: toTracks,
      proposalId: noteProposals.id,
      proposalStatus: noteProposals.status,
      proposalKey: noteProposals.proposalKey,
      proposalSourceStart: noteProposals.sourceStart,
      proposalSourceEnd: noteProposals.sourceEnd,
      proposalSourceText: noteProposals.sourceText,
    })
    .from(transitions)
    .innerJoin(fromTracks, eq(transitions.fromTrackId, fromTracks.id))
    .innerJoin(toTracks, eq(transitions.toTrackId, toTracks.id))
    .leftJoin(noteProposals, eq(transitions.sourceProposalId, noteProposals.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(fetchLimit)
    .offset(offset);

  const rows = await baseQuery;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const records = await hydrateTransitionRecords(
    page.map((row) => row.edge),
    page.map((row) => row.from),
    page.map((row) => row.to),
  );

  return {
    transitions: records.map((record, index) => {
      const row = page[index]!;
      const proposal =
        includeProposal && row.proposalId
          ? {
              id: row.proposalId,
              status: row.proposalStatus!,
              proposalKey: row.proposalKey!,
              sourceStart: row.proposalSourceStart!,
              sourceEnd: row.proposalSourceEnd!,
              sourceText: row.proposalSourceText!,
            }
          : null;
      return { ...record, proposal };
    }),
    limit,
    offset,
    hasMore,
  };
}

/**
 * Patch editable domain fields on one transition by id.
 * Does not change endpoints, id, or provenance keys.
 */
export async function updateTransitionById(
  id: string,
  input: UpdateTransitionInput,
): Promise<TransitionRecord> {
  const transitionId = requireTrimmed(id, "id");

  const hasPatch =
    input.fromBar !== undefined ||
    input.toBar !== undefined ||
    input.barsOverlap !== undefined ||
    input.technique !== undefined ||
    input.intent !== undefined ||
    input.quality !== undefined ||
    input.notes !== undefined;
  if (!hasPatch) {
    throw new MusicWriteError("invalid_input", "updateTransitionById requires at least one field.");
  }

  const [existing] = await getExecutor()
    .select()
    .from(transitions)
    .where(eq(transitions.id, transitionId))
    .limit(1);
  if (!existing) {
    throw new MusicWriteError("not_found", `Transition "${transitionId}" was not found.`);
  }

  const patch: Partial<TransitionRow> = {
    updatedAt: new Date(),
  };
  if (input.fromBar !== undefined) {
    patch.fromBar = optionalNumber(input.fromBar);
  }
  if (input.toBar !== undefined) {
    patch.toBar = optionalNumber(input.toBar);
  }
  if (input.barsOverlap !== undefined) {
    patch.barsOverlap = optionalNumber(input.barsOverlap);
  }
  if (input.technique !== undefined) {
    patch.technique = optionalString(input.technique);
  }
  if (input.intent !== undefined) {
    patch.intent = optionalString(input.intent);
  }
  if (input.quality !== undefined) {
    patch.quality = optionalString(input.quality);
  }
  if (input.notes !== undefined) {
    patch.notes = optionalString(input.notes);
  }

  await getExecutor().update(transitions).set(patch).where(eq(transitions.id, transitionId));

  const record = await loadTransitionRecord(transitionId);
  if (!record) {
    throw new MusicWriteError("not_found", `Transition "${transitionId}" was not found.`);
  }
  return record;
}

/** Hard-delete exactly one transition by stable edge id. */
export async function deleteTransitionById(id: string): Promise<{ id: string; deleted: boolean }> {
  const transitionId = requireTrimmed(id, "id");
  const deleted = await getExecutor()
    .delete(transitions)
    .where(eq(transitions.id, transitionId))
    .returning({ id: transitions.id });
  const deletedId = deleted[0]?.id;
  if (!deletedId) {
    throw new MusicWriteError("not_found", `Transition "${transitionId}" was not found.`);
  }
  return { id: deletedId, deleted: true };
}

/** Count committed edges from A→B (one direction). */
export async function countTransitionsBetween(
  fromTrackId: string,
  toTrackId: string,
): Promise<number> {
  const fromId = requireTrimmed(fromTrackId, "fromTrackId");
  const toId = requireTrimmed(toTrackId, "toTrackId");
  const [row] = await getExecutor()
    .select({ count: sql<number>`count(*)::int` })
    .from(transitions)
    .where(and(eq(transitions.fromTrackId, fromId), eq(transitions.toTrackId, toId)));
  return Number(row?.count) || 0;
}

/**
 * Idempotently insert a transition keyed by `proposalKey`.
 * Replay returns the existing edge without updating properties.
 */
export async function commitTransitionProposal(
  input: CommitTransitionInput,
): Promise<CommitTransitionResult> {
  const fromTrackId = requireTrimmed(input.fromTrackId, "fromTrackId");
  const toTrackId = requireTrimmed(input.toTrackId, "toTrackId");
  const proposalKey = requireTrimmed(input.proposalKey, "proposalKey");
  const sourceNoteId = requireTrimmed(input.sourceNoteId, "sourceNoteId");
  if (!Number.isInteger(input.sourceNoteVersion) || input.sourceNoteVersion < 0) {
    throw new MusicWriteError("invalid_input", "sourceNoteVersion must be a non-negative integer.");
  }

  await assertTracksExist(fromTrackId, toTrackId);

  const id = randomUUID();
  const inserted = await getExecutor()
    .insert(transitions)
    .values({
      id,
      fromTrackId,
      toTrackId,
      proposalKey,
      sourceNoteId,
      sourceNoteVersion: input.sourceNoteVersion,
      sourceProposalId: optionalString(input.sourceProposalId),
      confidence: optionalNumber(input.confidence),
      fromBar: optionalNumber(input.fromBar),
      toBar: optionalNumber(input.toBar),
      barsOverlap: optionalNumber(input.barsOverlap),
      technique: optionalString(input.technique),
      intent: optionalString(input.intent),
      quality: optionalString(input.quality),
      notes: optionalString(input.notes),
    })
    .onConflictDoNothing({
      target: transitions.proposalKey,
      where: sql`${transitions.proposalKey} IS NOT NULL`,
    })
    .returning();

  if (inserted[0]) {
    return {
      id: inserted[0].id,
      proposalKey,
      fromTrackId,
      toTrackId,
      created: true,
      properties: transitionProperties(inserted[0]),
    };
  }

  const [existing] = await getExecutor()
    .select()
    .from(transitions)
    .where(eq(transitions.proposalKey, proposalKey))
    .limit(1);
  if (!existing) {
    throw new MusicWriteError("invalid_input", "Failed to commit transition proposal.");
  }
  return {
    id: existing.id,
    proposalKey,
    fromTrackId: existing.fromTrackId,
    toTrackId: existing.toTrackId,
    created: false,
    properties: transitionProperties(existing),
  };
}

/** Commit multiple transitions sequentially (same as graph helper). */
export async function commitTransitionProposals(
  inputs: CommitTransitionInput[],
): Promise<CommitTransitionResult[]> {
  const results: CommitTransitionResult[] = [];
  for (const input of inputs) {
    results.push(await commitTransitionProposal(input));
  }
  return results;
}

// Re-export mapper used by tests / callers that previously imported from neighborhood.
export { asTransitionEdge };
