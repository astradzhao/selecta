import { readCypher } from "./cypher";
import { asFolder, asNamed, asTrack } from "./mappers";
import type { GraphFolderNode, GraphNamedNode, GraphTrackNode } from "./types";
import type { TrackSummary } from "./tracks";

/** Transition edge fields returned for graph explorer detail panels. */
export type TransitionEdgeSummary = {
  id: string | null;
  proposalKey: string | null;
  sourceNoteId: string | null;
  sourceNoteVersion: number | null;
  sourceProposalId: string | null;
  confidence: number | null;
  fromBar: number | null;
  toBar: number | null;
  barsOverlap: number | null;
  technique: string | null;
  intent: string | null;
  quality: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type NeighborhoodNeighbor = {
  track: GraphTrackNode;
  artists: GraphNamedNode[];
  genres: GraphNamedNode[];
  subgenres: GraphNamedNode[];
  folders: GraphFolderNode[];
  transition: TransitionEdgeSummary;
};

export type TrackNeighborhood = {
  current: TrackSummary;
  /** Outbound neighbors, best transition per target, stable ranked order. */
  neighbors: NeighborhoodNeighbor[];
};

function asNeo4jNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    value != null &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function asTransitionEdge(props: Record<string, unknown> | null): TransitionEdgeSummary {
  if (!props) {
    return {
      id: null,
      proposalKey: null,
      sourceNoteId: null,
      sourceNoteVersion: null,
      sourceProposalId: null,
      confidence: null,
      fromBar: null,
      toBar: null,
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
    sourceNoteId: asOptionalString(props.sourceNoteId),
    sourceNoteVersion: asNeo4jNumber(props.sourceNoteVersion),
    sourceProposalId: asOptionalString(props.sourceProposalId),
    confidence: asNeo4jNumber(props.confidence),
    fromBar: asNeo4jNumber(props.fromBar),
    toBar: asNeo4jNumber(props.toBar),
    barsOverlap: asNeo4jNumber(props.barsOverlap),
    technique: asOptionalString(props.technique),
    intent: asOptionalString(props.intent),
    quality: asOptionalString(props.quality),
    notes: asOptionalString(props.notes),
    createdAt: asOptionalString(props.createdAt),
    updatedAt: asOptionalString(props.updatedAt),
  };
}

/** Lower is better. Matches ARCHITECTURE §6.4 / §11 quality preference. */
export function transitionQualityRank(quality: string | null | undefined): number {
  switch (quality) {
    case "great":
      return 0;
    case "ok":
      return 1;
    case "risky":
      return 2;
    default:
      return 3;
  }
}

/**
 * Stable ranking for outbound neighbors (ARCHITECTURE §11, local MVP):
 * quality → confidence DESC → fromBar ASC → title → edge id → proposalKey.
 */
export function compareNeighborhoodNeighbors(
  a: NeighborhoodNeighbor,
  b: NeighborhoodNeighbor,
): number {
  const qualityDelta =
    transitionQualityRank(a.transition.quality) - transitionQualityRank(b.transition.quality);
  if (qualityDelta !== 0) return qualityDelta;

  const confA = a.transition.confidence;
  const confB = b.transition.confidence;
  if (confA != null || confB != null) {
    if (confA == null) return 1;
    if (confB == null) return -1;
    if (confA !== confB) return confB - confA;
  }

  const barA = a.transition.fromBar;
  const barB = b.transition.fromBar;
  if (barA != null || barB != null) {
    if (barA == null) return 1;
    if (barB == null) return -1;
    if (barA !== barB) return barA - barB;
  }

  const titleDelta = a.track.title.localeCompare(b.track.title, undefined, {
    sensitivity: "base",
  });
  if (titleDelta !== 0) return titleDelta;

  const idA = a.transition.id ?? "";
  const idB = b.transition.id ?? "";
  const idDelta = idA.localeCompare(idB);
  if (idDelta !== 0) return idDelta;

  const keyA = a.transition.proposalKey ?? "";
  const keyB = b.transition.proposalKey ?? "";
  return keyA.localeCompare(keyB);
}

/**
 * Keep the best-ranked transition per neighbor track id, then sort.
 * Multiple notes may create multiple TRANSITION edges to the same target.
 */
export function rankNeighborhoodNeighbors(
  neighbors: NeighborhoodNeighbor[],
): NeighborhoodNeighbor[] {
  const bestByTrackId = new Map<string, NeighborhoodNeighbor>();
  for (const neighbor of neighbors) {
    const existing = bestByTrackId.get(neighbor.track.id);
    if (!existing || compareNeighborhoodNeighbors(neighbor, existing) < 0) {
      bestByTrackId.set(neighbor.track.id, neighbor);
    }
  }
  return [...bestByTrackId.values()].sort(compareNeighborhoodNeighbors);
}

type NeighborRow = {
  track: Record<string, unknown> | null;
  transition: Record<string, unknown> | null;
  artists: GraphNamedNode[];
  genres: GraphNamedNode[];
  subgenres: GraphNamedNode[];
  folders: GraphFolderNode[];
};

function mapNeighborRow(row: NeighborRow): NeighborhoodNeighbor | null {
  if (!row.track?.id || typeof row.track.id !== "string") {
    return null;
  }
  return {
    track: asTrack(row.track),
    artists: (row.artists ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    genres: (row.genres ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    subgenres: (row.subgenres ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    folders: (row.folders ?? []).map(asFolder).filter((n): n is GraphFolderNode => n !== null),
    transition: asTransitionEdge(row.transition),
  };
}

function mapCurrentSummary(row: {
  track: Record<string, unknown>;
  artists: GraphNamedNode[];
  genres: GraphNamedNode[];
  subgenres: GraphNamedNode[];
  folders: GraphFolderNode[];
}): TrackSummary {
  return {
    track: asTrack(row.track),
    artists: (row.artists ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    genres: (row.genres ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    subgenres: (row.subgenres ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    folders: (row.folders ?? []).map(asFolder).filter((n): n is GraphFolderNode => n !== null),
  };
}

/**
 * Current track + ranked outbound TRANSITION neighbors for the graph explorer.
 * Neo4j-only — no Postgres membership or live session. Returns null when track missing.
 */
export async function getTrackNeighborhood(id: string): Promise<TrackNeighborhood | null> {
  const trackId = id.trim();
  if (!trackId) {
    return null;
  }

  const rows = await readCypher<{
    current: Record<string, unknown>;
    artists: GraphNamedNode[];
    genres: GraphNamedNode[];
    subgenres: GraphNamedNode[];
    folders: GraphFolderNode[];
    neighborRows: NeighborRow[];
  }>(
    `
    MATCH (current:Track {id: $trackId})
    OPTIONAL MATCH (ca:Artist)-[:BY]->(current)
    OPTIONAL MATCH (current)-[:IN_GENRE]->(cg:Genre)
    OPTIONAL MATCH (current)-[:IN_SUBGENRE]->(csg:Subgenre)
    OPTIONAL MATCH (current)-[:IN_FOLDER]->(cf:Folder)
    WITH current,
         collect(DISTINCT ca { .id, .name, .nameNormalized }) AS artists,
         collect(DISTINCT cg { .id, .name, .nameNormalized }) AS genres,
         collect(DISTINCT csg { .id, .name, .nameNormalized }) AS subgenres,
         collect(DISTINCT cf { .id, .name, .nameNormalized, .kind }) AS folders
    OPTIONAL MATCH (current)-[t:TRANSITION]->(next:Track)
    OPTIONAL MATCH (na:Artist)-[:BY]->(next)
    OPTIONAL MATCH (next)-[:IN_GENRE]->(ng:Genre)
    OPTIONAL MATCH (next)-[:IN_SUBGENRE]->(nsg:Subgenre)
    OPTIONAL MATCH (next)-[:IN_FOLDER]->(nf:Folder)
    WITH current, artists, genres, subgenres, folders, next, t,
         collect(DISTINCT na { .id, .name, .nameNormalized }) AS nextArtists,
         collect(DISTINCT ng { .id, .name, .nameNormalized }) AS nextGenres,
         collect(DISTINCT nsg { .id, .name, .nameNormalized }) AS nextSubgenres,
         collect(DISTINCT nf { .id, .name, .nameNormalized, .kind }) AS nextFolders
    RETURN current { .* } AS current,
           artists,
           genres,
           subgenres,
           folders,
           collect(
             CASE WHEN next IS NULL THEN null
             ELSE {
               track: next { .* },
               transition: t { .* },
               artists: nextArtists,
               genres: nextGenres,
               subgenres: nextSubgenres,
               folders: nextFolders
             } END
           ) AS neighborRows
    `,
    { trackId },
  );

  const row = rows[0];
  if (!row?.current?.id) {
    return null;
  }

  const mapped = (row.neighborRows ?? [])
    .filter((item): item is NeighborRow => item != null && typeof item === "object")
    .map(mapNeighborRow)
    .filter((n): n is NeighborhoodNeighbor => n !== null);

  return {
    current: mapCurrentSummary({
      track: row.current,
      artists: row.artists,
      genres: row.genres,
      subgenres: row.subgenres,
      folders: row.folders,
    }),
    neighbors: rankNeighborhoodNeighbors(mapped),
  };
}
