import { eq } from "drizzle-orm";

import { getDb } from "@selecta/db";
import { transitions, type TransitionRow } from "@selecta/db/schema";
import { compareNeighborhoodNeighbors } from "./neighborhood-rank";
import type { FolderNode, NamedNode, TrackNode, TrackSummary } from "./types";
import { getTrackById, getTrackSummariesByIds } from "./tracks";

export {
  compareNeighborhoodNeighbors,
  transitionQualityRank,
  type RankableNeighbor,
} from "./neighborhood-rank";

/** Transition edge fields returned for graph explorer detail panels. */
export type TransitionEdgeSummary = {
  id: string | null;
  proposalKey: string | null;
  sourceSubmissionId: string | null;
  sourceSubmissionVersion: number | null;
  sourceProposalId: string | null;
  confidence: number | null;
  fromBar: number | null;
  toBar: number | null;
  fromCue: string | null;
  toCue: string | null;
  barsOverlap: number | null;
  technique: string | null;
  intent: string | null;
  quality: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/** Destination group: one track with all outbound transitions (best-first). */
export type NeighborhoodNeighbor = {
  track: TrackNode;
  artists: NamedNode[];
  genres: NamedNode[];
  subgenres: NamedNode[];
  folders: FolderNode[];
  /** Outbound edges to this destination, sorted best-first (`[0]` is the winner). */
  transitions: TransitionEdgeSummary[];
};

/** Flat row before grouping (one edge per entry). */
export type FlatNeighborhoodNeighbor = {
  track: TrackNode;
  artists: NamedNode[];
  genres: NamedNode[];
  subgenres: NamedNode[];
  folders: FolderNode[];
  transition: TransitionEdgeSummary;
};

export type TrackNeighborhood = {
  current: TrackSummary;
  /** Outbound destination groups, ordered by each group's best edge. */
  neighbors: NeighborhoodNeighbor[];
};

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

export function asTransitionEdge(props: Record<string, unknown> | null): TransitionEdgeSummary {
  if (!props) {
    return {
      id: null,
      proposalKey: null,
      sourceSubmissionId: null,
      sourceSubmissionVersion: null,
      sourceProposalId: null,
      confidence: null,
      fromBar: null,
      toBar: null,
      fromCue: null,
      toCue: null,
      barsOverlap: null,
      technique: null,
      intent: null,
      quality: null,
      notes: null,
      createdAt: null,
      updatedAt: null,
    };
  }
  return {
    id: asOptionalString(props.id),
    proposalKey: asOptionalString(props.proposalKey),
    sourceSubmissionId: asOptionalString(props.sourceSubmissionId),
    sourceSubmissionVersion: asOptionalNumber(props.sourceSubmissionVersion),
    sourceProposalId: asOptionalString(props.sourceProposalId),
    confidence: asOptionalNumber(props.confidence),
    fromBar: asOptionalNumber(props.fromBar),
    toBar: asOptionalNumber(props.toBar),
    fromCue: asOptionalString(props.fromCue),
    toCue: asOptionalString(props.toCue),
    barsOverlap: asOptionalNumber(props.barsOverlap),
    technique: asOptionalString(props.technique),
    intent: asOptionalString(props.intent),
    quality: asOptionalString(props.quality),
    notes: asOptionalString(props.notes),
    createdAt: asOptionalString(props.createdAt),
    updatedAt: asOptionalString(props.updatedAt),
  };
}

export function transitionRowToEdge(row: TransitionRow): TransitionEdgeSummary {
  return {
    id: row.id,
    proposalKey: row.proposalKey ?? null,
    sourceSubmissionId: row.sourceSubmissionId ?? null,
    sourceSubmissionVersion: row.sourceSubmissionVersion ?? null,
    sourceProposalId: row.sourceProposalId ?? null,
    confidence: row.confidence ?? null,
    fromBar: row.fromBar ?? null,
    toBar: row.toBar ?? null,
    fromCue: row.fromCue ?? null,
    toCue: row.toCue ?? null,
    barsOverlap: row.barsOverlap ?? null,
    technique: row.technique ?? null,
    intent: row.intent ?? null,
    quality: row.quality ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Group flat edge rows by destination track: keep all edges (best-first),
 * then order groups by each group's best edge.
 */
export function rankNeighborhoodNeighbors(
  flat: FlatNeighborhoodNeighbor[],
): NeighborhoodNeighbor[] {
  type Group = {
    track: TrackNode;
    artists: NamedNode[];
    genres: NamedNode[];
    subgenres: NamedNode[];
    folders: FolderNode[];
    edges: TransitionEdgeSummary[];
  };

  const byTrackId = new Map<string, Group>();
  for (const row of flat) {
    const existing = byTrackId.get(row.track.id);
    if (!existing) {
      byTrackId.set(row.track.id, {
        track: row.track,
        artists: row.artists,
        genres: row.genres,
        subgenres: row.subgenres,
        folders: row.folders,
        edges: [row.transition],
      });
      continue;
    }
    existing.edges.push(row.transition);
  }

  const groups: NeighborhoodNeighbor[] = [];
  for (const group of byTrackId.values()) {
    const transitions = [...group.edges].sort((left, right) =>
      compareNeighborhoodNeighbors(
        { track: group.track, transition: left },
        { track: group.track, transition: right },
      ),
    );
    groups.push({
      track: group.track,
      artists: group.artists,
      genres: group.genres,
      subgenres: group.subgenres,
      folders: group.folders,
      transitions,
    });
  }

  return groups.sort((a, b) =>
    compareNeighborhoodNeighbors(
      { track: a.track, transition: a.transitions[0]! },
      { track: b.track, transition: b.transitions[0]! },
    ),
  );
}

/**
 * Current track + ranked outbound TRANSITION neighbors for the graph explorer.
 * Returns null when track missing.
 */
export async function getTrackNeighborhood(id: string): Promise<TrackNeighborhood | null> {
  const trackId = id.trim();
  if (!trackId) {
    return null;
  }

  const detail = await getTrackById(trackId);
  if (!detail) {
    return null;
  }
  const current: TrackSummary = {
    track: detail.track,
    artists: detail.artists,
    genres: detail.genres,
    subgenres: detail.subgenres,
    folders: detail.folders,
  };

  const edgeRows = await getDb()
    .select()
    .from(transitions)
    .where(eq(transitions.fromTrackId, trackId));

  if (edgeRows.length === 0) {
    return { current, neighbors: [] };
  }

  const summaries = await getTrackSummariesByIds(edgeRows.map((row) => row.toTrackId));
  const mapped: FlatNeighborhoodNeighbor[] = [];
  for (const edge of edgeRows) {
    const summary = summaries.get(edge.toTrackId);
    if (!summary) {
      continue;
    }
    mapped.push({
      track: summary.track,
      artists: summary.artists,
      genres: summary.genres,
      subgenres: summary.subgenres,
      folders: summary.folders,
      transition: transitionRowToEdge(edge),
    });
  }

  return {
    current,
    neighbors: rankNeighborhoodNeighbors(mapped),
  };
}
