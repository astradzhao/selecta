import neo4j from "neo4j-driver";

import { readCypher } from "./cypher";
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
  limit?: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

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

/**
 * Search/list local library tracks by title/artist with optional Subgenre/Folder facets.
 * Single-user MVP: no Postgres membership filter.
 */
export async function listTracks(input: ListTracksInput = {}): Promise<TrackSummary[]> {
  const query = input.query?.trim() ?? "";
  const queryNormalized = query ? normalizeName(query) : "";
  const subgenreId = input.subgenreId?.trim() || null;
  const subgenreNormalized = input.subgenre?.trim() ? normalizeName(input.subgenre) : null;
  const folderId = input.folderId?.trim() || null;
  const folderNormalized = input.folder?.trim() ? normalizeName(input.folder) : null;
  const limit = clampLimit(input.limit);

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
    OPTIONAL MATCH (track)-[:IN_GENRE]->(genre:Genre)
    OPTIONAL MATCH (track)-[:IN_SUBGENRE]->(subgenre:Subgenre)
    OPTIONAL MATCH (track)-[:IN_FOLDER]->(folder:Folder)
    RETURN track { .* } AS track,
           [a IN artistNodes WHERE a IS NOT NULL | a { .id, .name, .nameNormalized }] AS artists,
           collect(DISTINCT genre { .id, .name, .nameNormalized }) AS genres,
           collect(DISTINCT subgenre { .id, .name, .nameNormalized }) AS subgenres,
           collect(DISTINCT folder { .id, .name, .nameNormalized, .kind }) AS folders
    ORDER BY toLower(track.title) ASC
    LIMIT $limit
    `,
    {
      queryNormalized,
      subgenreId,
      subgenreNormalized,
      folderId,
      folderNormalized,
      limit: neo4j.int(limit),
    },
  );

  return rows.map(mapTrackRow);
}

export type TrackDetail = TrackSummary & {
  /** Whether any outbound TRANSITION edges exist. */
  hasOutboundTransitions: boolean;
  /** Whether any inbound TRANSITION edges exist. */
  hasInboundTransitions: boolean;
};

/**
 * Track detail for library page / M4 entry.
 * Subgenres and Folders remain distinct arrays. Ranked neighborhood is DJ-40.
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
