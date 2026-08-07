import neo4j from "neo4j-driver";

import { readCypher } from "./cypher";
import { clampListLimit, clampListOffset, type ListPageMeta } from "./list-page";
import { asFolder, asNamed, asTrack } from "./mappers";
import { normalizeName } from "./normalize";
import type { GraphFolderNode, GraphNamedNode, GraphTrackNode } from "./types";

export type TrackSummary = {
  track: GraphTrackNode;
  artists: GraphNamedNode[];
  genres: GraphNamedNode[];
  subgenres: GraphNamedNode[];
  folders: GraphFolderNode[];
};

export type TrackSortField = "title" | "createdAt" | "updatedAt";
export type ListSortOrder = "asc" | "desc";

export type ListTracksInput = {
  /** Free-form match against track title and artist names. */
  query?: string;
  /** Filter: track must be in this Subgenre (id). */
  subgenreId?: string;
  /** Filter: track must be in Subgenre matching this name. */
  subgenre?: string;
  /** Filter: track must be in this Folder (id). */
  folderId?: string;
  /** Filter: track must be in Folder matching this name. */
  folder?: string;
  /** Inclusive lower bound on createdAt (ISO string). */
  createdAfter?: string;
  /** Inclusive upper bound on createdAt (ISO string). */
  createdBefore?: string;
  /** Inclusive lower bound on updatedAt (ISO string). */
  updatedAfter?: string;
  /** Inclusive upper bound on updatedAt (ISO string). */
  updatedBefore?: string;
  sort?: TrackSortField;
  order?: ListSortOrder;
  limit?: number;
  offset?: number;
};

export type ListTracksResult = {
  tracks: TrackSummary[];
} & ListPageMeta;

function mapTrackRow(row: {
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

function trackOrderBy(sort: TrackSortField, order: ListSortOrder): string {
  const dir = order === "desc" ? "DESC" : "ASC";
  switch (sort) {
    case "createdAt":
      return `coalesce(track.createdAt, '') ${dir}, toLower(track.title) ASC, track.id ASC`;
    case "updatedAt":
      return `coalesce(track.updatedAt, '') ${dir}, toLower(track.title) ASC, track.id ASC`;
    case "title":
    default:
      return `toLower(track.title) ${dir}, track.id ASC`;
  }
}

/**
 * Search/list local library tracks by title/artist with optional Subgenre/Folder facets.
 * Single-user MVP: no Postgres membership filter.
 */
export async function listTracks(input: ListTracksInput = {}): Promise<ListTracksResult> {
  const query = input.query?.trim() ?? "";
  const queryNormalized = query ? normalizeName(query) : "";
  const subgenreId = input.subgenreId?.trim() || null;
  const subgenreNormalized = input.subgenre?.trim() ? normalizeName(input.subgenre) : null;
  const folderId = input.folderId?.trim() || null;
  const folderNormalized = input.folder?.trim() ? normalizeName(input.folder) : null;
  const createdAfter = input.createdAfter?.trim() || null;
  const createdBefore = input.createdBefore?.trim() || null;
  const updatedAfter = input.updatedAfter?.trim() || null;
  const updatedBefore = input.updatedBefore?.trim() || null;
  const sort: TrackSortField =
    input.sort === "createdAt" || input.sort === "updatedAt" || input.sort === "title"
      ? input.sort
      : "title";
  const order: ListSortOrder = input.order === "desc" ? "desc" : "asc";
  const limit = clampListLimit(input.limit);
  const offset = clampListOffset(input.offset);
  // Fetch one extra row to compute hasMore without a separate count query.
  const fetchLimit = limit + 1;

  const rows = await readCypher<{
    track: Record<string, unknown>;
    artists: GraphNamedNode[];
    genres: GraphNamedNode[];
    subgenres: GraphNamedNode[];
    folders: GraphFolderNode[];
  }>(
    `
    MATCH (track:Track)
    OPTIONAL MATCH (artist:Artist)-[:BY]->(track)
    WITH track, collect(DISTINCT artist) AS artistNodes
    WHERE ($queryNormalized = '' OR
      toLower(track.title) CONTAINS $queryNormalized OR
      any(a IN artistNodes WHERE toLower(a.name) CONTAINS $queryNormalized))
    AND ($subgenreId IS NULL OR EXISTS {
      MATCH (track)-[:IN_SUBGENRE]->(sg:Subgenre {id: $subgenreId})
    })
    AND ($subgenreNormalized IS NULL OR EXISTS {
      MATCH (track)-[:IN_SUBGENRE]->(sg:Subgenre {nameNormalized: $subgenreNormalized})
    })
    AND ($folderId IS NULL OR EXISTS {
      MATCH (track)-[:IN_FOLDER]->(f:Folder {id: $folderId})
    })
    AND ($folderNormalized IS NULL OR EXISTS {
      MATCH (track)-[:IN_FOLDER]->(f:Folder {nameNormalized: $folderNormalized})
    })
    AND ($createdAfter IS NULL OR coalesce(track.createdAt, '') >= $createdAfter)
    AND ($createdBefore IS NULL OR coalesce(track.createdAt, '') <= $createdBefore)
    AND ($updatedAfter IS NULL OR coalesce(track.updatedAt, '') >= $updatedAfter)
    AND ($updatedBefore IS NULL OR coalesce(track.updatedAt, '') <= $updatedBefore)
    OPTIONAL MATCH (track)-[:IN_GENRE]->(genre:Genre)
    OPTIONAL MATCH (track)-[:IN_SUBGENRE]->(subgenre:Subgenre)
    OPTIONAL MATCH (track)-[:IN_FOLDER]->(folder:Folder)
    RETURN track { .* } AS track,
           [a IN artistNodes WHERE a IS NOT NULL | a { .id, .name, .nameNormalized }] AS artists,
           collect(DISTINCT genre { .id, .name, .nameNormalized }) AS genres,
           collect(DISTINCT subgenre { .id, .name, .nameNormalized }) AS subgenres,
           collect(DISTINCT folder { .id, .name, .nameNormalized, .kind }) AS folders
    ORDER BY ${trackOrderBy(sort, order)}
    SKIP $offset
    LIMIT $limit
    `,
    {
      queryNormalized,
      subgenreId,
      subgenreNormalized,
      folderId,
      folderNormalized,
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
    tracks: page.map(mapTrackRow),
    limit,
    offset,
    hasMore,
  };
}

export type LibraryStats = {
  count: number;
  /** ISO timestamp of the most recently updated Track, or null when empty. */
  latestUpdatedAt: string | null;
};

/**
 * Cheap library fingerprint for client cache invalidation.
 * Prefer this over a full listTracks when checking whether cached data is stale.
 */
export async function getLibraryStats(): Promise<LibraryStats> {
  const rows = await readCypher<{ count: unknown; latestUpdatedAt: unknown }>(
    `
    MATCH (t:Track)
    RETURN count(t) AS count, max(t.updatedAt) AS latestUpdatedAt
    `,
  );

  const row = rows[0];
  const rawCount = row?.count;
  const count =
    typeof rawCount === "number"
      ? rawCount
      : rawCount != null &&
          typeof rawCount === "object" &&
          "toNumber" in rawCount &&
          typeof (rawCount as { toNumber: () => number }).toNumber === "function"
        ? (rawCount as { toNumber: () => number }).toNumber()
        : 0;

  const latest =
    typeof row?.latestUpdatedAt === "string" && row.latestUpdatedAt.trim()
      ? row.latestUpdatedAt
      : null;

  return { count, latestUpdatedAt: latest };
}

export type TrackDetail = TrackSummary & {
  /** Whether any outbound TRANSITION edges exist. */
  hasOutboundTransitions: boolean;
  /** Whether any inbound TRANSITION edges exist. */
  hasInboundTransitions: boolean;
};

/**
 * Track detail for library page / M4 entry.
 * Subgenres and Folders remain distinct arrays.
 * Ranked outbound neighborhood: `getTrackNeighborhood` (DJ-40).
 */
export async function getTrackById(id: string): Promise<TrackDetail | null> {
  const trackId = id.trim();
  if (!trackId) {
    return null;
  }

  const rows = await readCypher<{
    track: Record<string, unknown>;
    artists: GraphNamedNode[];
    genres: GraphNamedNode[];
    subgenres: GraphNamedNode[];
    folders: GraphFolderNode[];
    hasOutboundTransitions: boolean;
    hasInboundTransitions: boolean;
  }>(
    `
    MATCH (track:Track {id: $trackId})
    OPTIONAL MATCH (artist:Artist)-[:BY]->(track)
    OPTIONAL MATCH (track)-[:IN_GENRE]->(genre:Genre)
    OPTIONAL MATCH (track)-[:IN_SUBGENRE]->(subgenre:Subgenre)
    OPTIONAL MATCH (track)-[:IN_FOLDER]->(folder:Folder)
    OPTIONAL MATCH (track)-[out:TRANSITION]->(:Track)
    OPTIONAL MATCH (:Track)-[inn:TRANSITION]->(track)
    RETURN track { .* } AS track,
           collect(DISTINCT artist { .id, .name, .nameNormalized }) AS artists,
           collect(DISTINCT genre { .id, .name, .nameNormalized }) AS genres,
           collect(DISTINCT subgenre { .id, .name, .nameNormalized }) AS subgenres,
           collect(DISTINCT folder { .id, .name, .nameNormalized, .kind }) AS folders,
           count(DISTINCT out) > 0 AS hasOutboundTransitions,
           count(DISTINCT inn) > 0 AS hasInboundTransitions
    `,
    { trackId },
  );

  const row = rows[0];
  if (!row?.track?.id) {
    return null;
  }

  return {
    ...mapTrackRow(row),
    hasOutboundTransitions: Boolean(row.hasOutboundTransitions),
    hasInboundTransitions: Boolean(row.hasInboundTransitions),
  };
}

/**
 * Exact Track lookup by provider external id (`spotify:<id>` stored in `externalIds`).
 * Used after Spotify catalog match to reuse an existing library node.
 */
export async function getTrackByExternalId(
  provider: string,
  providerId: string,
): Promise<TrackSummary | null> {
  const providerKey = provider.trim().toLowerCase();
  const id = providerId.trim();
  if (!providerKey || !id || providerKey.includes(":")) {
    return null;
  }
  const entry = `${providerKey}:${id}`;

  const rows = await readCypher<{
    track: Record<string, unknown>;
    artists: GraphNamedNode[];
    genres: GraphNamedNode[];
    subgenres: GraphNamedNode[];
    folders: GraphFolderNode[];
  }>(
    `
    MATCH (track:Track)
    WHERE $entry IN coalesce(track.externalIds, [])
    OPTIONAL MATCH (artist:Artist)-[:BY]->(track)
    OPTIONAL MATCH (track)-[:IN_GENRE]->(genre:Genre)
    OPTIONAL MATCH (track)-[:IN_SUBGENRE]->(subgenre:Subgenre)
    OPTIONAL MATCH (track)-[:IN_FOLDER]->(folder:Folder)
    RETURN track { .* } AS track,
           collect(DISTINCT artist { .id, .name, .nameNormalized }) AS artists,
           collect(DISTINCT genre { .id, .name, .nameNormalized }) AS genres,
           collect(DISTINCT subgenre { .id, .name, .nameNormalized }) AS subgenres,
           collect(DISTINCT folder { .id, .name, .nameNormalized, .kind }) AS folders
    LIMIT 1
    `,
    { entry },
  );

  const row = rows[0];
  if (!row?.track?.id) {
    return null;
  }
  return mapTrackRow(row);
}
