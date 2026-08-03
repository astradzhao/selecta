import neo4j from "neo4j-driver";

import { readCypher } from "./cypher";
import { normalizeName } from "./normalize";
import { isFolderKind, type FolderKind } from "./schema";
import type { GraphFolderNode, GraphNamedNode, GraphSongNode } from "./types";

export type SongSummary = {
  song: GraphSongNode;
  artists: GraphNamedNode[];
  genres: GraphNamedNode[];
  subgenres: GraphNamedNode[];
  folders: GraphFolderNode[];
};

export type ListSongsInput = {
  /** Free-form match against song title and artist names. */
  query?: string;
  /** Filter: song must be in this Subgenre (id). */
  subgenreId?: string;
  /** Filter: song must be in Subgenre matching this name. */
  subgenre?: string;
  /** Filter: song must be in this Folder (id). */
  folderId?: string;
  /** Filter: song must be in Folder matching this name. */
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

function asNamed(row: {
  id?: unknown;
  name?: unknown;
  nameNormalized?: unknown;
}): GraphNamedNode | null {
  if (typeof row.id !== "string" || typeof row.name !== "string") {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    nameNormalized:
      typeof row.nameNormalized === "string" ? row.nameNormalized : normalizeName(row.name),
  };
}

function asFolder(row: {
  id?: unknown;
  name?: unknown;
  nameNormalized?: unknown;
  kind?: unknown;
}): GraphFolderNode | null {
  const named = asNamed(row);
  if (!named) {
    return null;
  }
  const kind: FolderKind | null =
    typeof row.kind === "string" && isFolderKind(row.kind) ? row.kind : null;
  return { ...named, kind };
}

function asSong(props: Record<string, unknown>): GraphSongNode {
  const externalIds =
    props.externalIds && typeof props.externalIds === "object" && !Array.isArray(props.externalIds)
      ? Object.fromEntries(
          Object.entries(props.externalIds as Record<string, unknown>).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : {};

  return {
    id: String(props.id),
    title: String(props.title ?? ""),
    bpm: typeof props.bpm === "number" ? props.bpm : null,
    musicalKey: typeof props.musicalKey === "string" ? props.musicalKey : null,
    durationSec: typeof props.durationSec === "number" ? props.durationSec : null,
    energy: typeof props.energy === "number" ? props.energy : null,
    artworkUrl: typeof props.artworkUrl === "string" ? props.artworkUrl : null,
    releaseDate: typeof props.releaseDate === "string" ? props.releaseDate : null,
    externalIds,
    libraryId: typeof props.libraryId === "string" ? props.libraryId : null,
    createdAt: String(props.createdAt ?? ""),
    updatedAt: String(props.updatedAt ?? ""),
  };
}

function mapSongRow(row: {
  song: Record<string, unknown>;
  artists: GraphNamedNode[];
  genres: GraphNamedNode[];
  subgenres: GraphNamedNode[];
  folders: GraphFolderNode[];
}): SongSummary {
  return {
    song: asSong(row.song),
    artists: (row.artists ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    genres: (row.genres ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    subgenres: (row.subgenres ?? []).map(asNamed).filter((n): n is GraphNamedNode => n !== null),
    folders: (row.folders ?? []).map(asFolder).filter((n): n is GraphFolderNode => n !== null),
  };
}

/**
 * Search/list local library songs by title/artist with optional Subgenre/Folder facets.
 * Single-user MVP: no Postgres membership filter.
 */
export async function listSongs(input: ListSongsInput = {}): Promise<SongSummary[]> {
  const query = input.query?.trim() ?? "";
  const queryNormalized = query ? normalizeName(query) : "";
  const subgenreId = input.subgenreId?.trim() || null;
  const subgenreNormalized = input.subgenre?.trim() ? normalizeName(input.subgenre) : null;
  const folderId = input.folderId?.trim() || null;
  const folderNormalized = input.folder?.trim() ? normalizeName(input.folder) : null;
  const limit = clampLimit(input.limit);

  const rows = await readCypher<{
    song: Record<string, unknown>;
    artists: GraphNamedNode[];
    genres: GraphNamedNode[];
    subgenres: GraphNamedNode[];
    folders: GraphFolderNode[];
  }>(
    `
    MATCH (song:Song)
    OPTIONAL MATCH (artist:Artist)-[:BY]->(song)
    WITH song, collect(DISTINCT artist) AS artistNodes
    WHERE ($queryNormalized = '' OR
      toLower(song.title) CONTAINS $queryNormalized OR
      any(a IN artistNodes WHERE toLower(a.name) CONTAINS $queryNormalized))
    AND ($subgenreId IS NULL OR EXISTS {
      MATCH (song)-[:IN_SUBGENRE]->(sg:Subgenre {id: $subgenreId})
    })
    AND ($subgenreNormalized IS NULL OR EXISTS {
      MATCH (song)-[:IN_SUBGENRE]->(sg:Subgenre {nameNormalized: $subgenreNormalized})
    })
    AND ($folderId IS NULL OR EXISTS {
      MATCH (song)-[:IN_FOLDER]->(f:Folder {id: $folderId})
    })
    AND ($folderNormalized IS NULL OR EXISTS {
      MATCH (song)-[:IN_FOLDER]->(f:Folder {nameNormalized: $folderNormalized})
    })
    OPTIONAL MATCH (song)-[:IN_GENRE]->(genre:Genre)
    OPTIONAL MATCH (song)-[:IN_SUBGENRE]->(subgenre:Subgenre)
    OPTIONAL MATCH (song)-[:IN_FOLDER]->(folder:Folder)
    RETURN song { .* } AS song,
           [a IN artistNodes WHERE a IS NOT NULL | a { .id, .name, .nameNormalized }] AS artists,
           collect(DISTINCT genre { .id, .name, .nameNormalized }) AS genres,
           collect(DISTINCT subgenre { .id, .name, .nameNormalized }) AS subgenres,
           collect(DISTINCT folder { .id, .name, .nameNormalized, .kind }) AS folders
    ORDER BY toLower(song.title) ASC
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

  return rows.map(mapSongRow);
}

export type SongDetail = SongSummary & {
  /** Whether any outbound TRANSITION edges exist. */
  hasOutboundTransitions: boolean;
  /** Whether any inbound TRANSITION edges exist. */
  hasInboundTransitions: boolean;
};

/**
 * Song detail for library page / M4 entry.
 * Subgenres and Folders remain distinct arrays. Ranked neighborhood is DJ-40.
 */
export async function getSongById(id: string): Promise<SongDetail | null> {
  const songId = id.trim();
  if (!songId) {
    return null;
  }

  const rows = await readCypher<{
    song: Record<string, unknown>;
    artists: GraphNamedNode[];
    genres: GraphNamedNode[];
    subgenres: GraphNamedNode[];
    folders: GraphFolderNode[];
    hasOutboundTransitions: boolean;
    hasInboundTransitions: boolean;
  }>(
    `
    MATCH (song:Song {id: $songId})
    OPTIONAL MATCH (artist:Artist)-[:BY]->(song)
    OPTIONAL MATCH (song)-[:IN_GENRE]->(genre:Genre)
    OPTIONAL MATCH (song)-[:IN_SUBGENRE]->(subgenre:Subgenre)
    OPTIONAL MATCH (song)-[:IN_FOLDER]->(folder:Folder)
    OPTIONAL MATCH (song)-[out:TRANSITION]->(:Song)
    OPTIONAL MATCH (:Song)-[inn:TRANSITION]->(song)
    RETURN song { .* } AS song,
           collect(DISTINCT artist { .id, .name, .nameNormalized }) AS artists,
           collect(DISTINCT genre { .id, .name, .nameNormalized }) AS genres,
           collect(DISTINCT subgenre { .id, .name, .nameNormalized }) AS subgenres,
           collect(DISTINCT folder { .id, .name, .nameNormalized, .kind }) AS folders,
           count(DISTINCT out) > 0 AS hasOutboundTransitions,
           count(DISTINCT inn) > 0 AS hasInboundTransitions
    `,
    { songId },
  );

  const row = rows[0];
  if (!row?.song?.id) {
    return null;
  }

  return {
    ...mapSongRow(row),
    hasOutboundTransitions: Boolean(row.hasOutboundTransitions),
    hasInboundTransitions: Boolean(row.hasInboundTransitions),
  };
}
