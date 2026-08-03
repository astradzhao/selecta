import { randomUUID } from "node:crypto";

import neo4j, { type ManagedTransaction } from "neo4j-driver";

import { getDriver } from "./client";
import { readCypher, writeCypher } from "./cypher";
import { normalizeName } from "./normalize";
import { isFolderKind, type FolderKind } from "./schema";
import {
  assertFolderKind,
  GraphWriteError,
  type CreateSongInput,
  type CreateSongResult,
  type FolderRef,
  type GraphFolderNode,
  type GraphNamedNode,
  type GraphSongNode,
  type NamedRef,
  type SongExternalIds,
} from "./types";

type VocabParams = {
  id: string;
  name: string;
  nameNormalized: string;
};

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new GraphWriteError("invalid_input", `${label} must not be empty.`);
  }
  return trimmed;
}

function prepareVocab(name: string, label: string): VocabParams {
  const display = requireTrimmed(name, label);
  return {
    id: randomUUID(),
    name: display,
    nameNormalized: normalizeName(display),
  };
}

function cleanExternalIds(externalIds: SongExternalIds | undefined): Record<string, string> {
  if (!externalIds) {
    return {};
  }
  const cleaned: Record<string, string> = {};
  for (const [provider, value] of Object.entries(externalIds)) {
    const key = provider.trim();
    const id = value?.trim();
    if (key && id) {
      cleaned[key] = id;
    }
  }
  return cleaned;
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
    title: String(props.title),
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

async function runWrite<T>(work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}

/** MERGE Artist by nameNormalized; returns the node. */
export async function mergeArtist(name: string): Promise<GraphNamedNode> {
  const artist = prepareVocab(name, "Artist name");
  const rows = await writeCypher<{ a: GraphNamedNode }>(
    `
    MERGE (a:Artist {nameNormalized: $nameNormalized})
    ON CREATE SET a.id = $id, a.name = $name
    RETURN a { .id, .name, .nameNormalized } AS a
    `,
    artist,
  );
  const row = asNamed(rows[0]?.a ?? {});
  if (!row) {
    throw new GraphWriteError("not_found", "Failed to MERGE Artist.");
  }
  return row;
}

/** MERGE provider Genre by nameNormalized. */
export async function mergeGenre(name: string): Promise<GraphNamedNode> {
  const genre = prepareVocab(name, "Genre name");
  const rows = await writeCypher<{ g: GraphNamedNode }>(
    `
    MERGE (g:Genre {nameNormalized: $nameNormalized})
    ON CREATE SET g.id = $id, g.name = $name
    RETURN g { .id, .name, .nameNormalized } AS g
    `,
    genre,
  );
  const row = asNamed(rows[0]?.g ?? {});
  if (!row) {
    throw new GraphWriteError("not_found", "Failed to MERGE Genre.");
  }
  return row;
}

/** MERGE DJ Subgenre by nameNormalized. */
export async function mergeSubgenre(name: string): Promise<GraphNamedNode> {
  const subgenre = prepareVocab(name, "Subgenre name");
  const rows = await writeCypher<{ s: GraphNamedNode }>(
    `
    MERGE (s:Subgenre {nameNormalized: $nameNormalized})
    ON CREATE SET s.id = $id, s.name = $name
    RETURN s { .id, .name, .nameNormalized } AS s
    `,
    subgenre,
  );
  const row = asNamed(rows[0]?.s ?? {});
  if (!row) {
    throw new GraphWriteError("not_found", "Failed to MERGE Subgenre.");
  }
  return row;
}

/** MERGE DJ Folder by nameNormalized (optional kind). */
export async function mergeFolder(input: {
  name: string;
  kind?: string;
}): Promise<GraphFolderNode> {
  const display = requireTrimmed(input.name, "Folder name");
  const kind = assertFolderKind(input.kind) ?? null;
  const params = {
    id: randomUUID(),
    name: display,
    nameNormalized: normalizeName(display),
    kind,
  };
  const rows = await writeCypher<{ f: GraphFolderNode }>(
    `
    MERGE (f:Folder {nameNormalized: $nameNormalized})
    ON CREATE SET f.id = $id, f.name = $name, f.kind = $kind
    ON MATCH SET f.kind = coalesce($kind, f.kind)
    RETURN f { .id, .name, .nameNormalized, .kind } AS f
    `,
    params,
  );
  const row = asFolder(rows[0]?.f ?? {});
  if (!row) {
    throw new GraphWriteError("not_found", "Failed to MERGE Folder.");
  }
  return row;
}

async function resolveNamedRef(
  ref: NamedRef,
  label: string,
  nodeLabel: "Subgenre",
): Promise<VocabParams> {
  const id = ref.id?.trim();
  const name = ref.name?.trim();
  if (!id && !name) {
    throw new GraphWriteError("invalid_input", `${label} requires an id or name.`);
  }

  if (id) {
    const rows = await readCypher<{ n: GraphNamedNode }>(
      `
      MATCH (n:${nodeLabel} {id: $id})
      RETURN n { .id, .name, .nameNormalized } AS n
      `,
      { id },
    );
    const found = asNamed(rows[0]?.n ?? {});
    if (found) {
      return found;
    }
    if (!name) {
      throw new GraphWriteError("not_found", `${label} id "${id}" was not found.`);
    }
  }

  return prepareVocab(name!, label);
}

async function resolveFolderRef(
  ref: FolderRef,
  index: number,
): Promise<VocabParams & { kind: string | null }> {
  const id = ref.id?.trim();
  const name = ref.name?.trim();
  const kind = assertFolderKind(ref.kind) ?? null;
  if (!id && !name) {
    throw new GraphWriteError("invalid_input", `folders[${index}] requires an id or name.`);
  }

  if (id) {
    const rows = await readCypher<{ f: GraphFolderNode }>(
      `
      MATCH (f:Folder {id: $id})
      RETURN f { .id, .name, .nameNormalized, .kind } AS f
      `,
      { id },
    );
    const found = asFolder(rows[0]?.f ?? {});
    if (found) {
      return { ...found, kind: kind ?? found.kind };
    }
    if (!name) {
      throw new GraphWriteError("not_found", `Folder id "${id}" was not found.`);
    }
  }

  const vocab = prepareVocab(name!, `folders[${index}]`);
  return { ...vocab, kind };
}

/**
 * Create a Song (or reuse one matched by external provider id) and wire
 * Artist / Genre / Subgenre / Folder relationships.
 *
 * Genre = provider metadata; Subgenre = DJ musical label; Folder = crate/playlist.
 * Title + ≥1 artist required; genres/subgenres/folders optional.
 */
export async function createSong(input: CreateSongInput): Promise<CreateSongResult> {
  const title = requireTrimmed(input.title, "Title");
  const artistNames = (input.artists ?? []).map((name) => name.trim()).filter(Boolean);
  if (artistNames.length === 0) {
    throw new GraphWriteError("invalid_input", "At least one artist is required.");
  }

  const artists = artistNames.map((name) => prepareVocab(name, "Artist name"));
  const genres = (input.genres ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => prepareVocab(name, "Genre name"));

  const subgenres = await Promise.all(
    (input.subgenres ?? []).map((ref, index) =>
      resolveNamedRef(ref, `subgenres[${index}]`, "Subgenre"),
    ),
  );
  const folders = await Promise.all((input.folders ?? []).map(resolveFolderRef));
  const externalIds = cleanExternalIds(input.externalIds);
  const externalEntries = Object.entries(externalIds).map(([provider, providerId]) => ({
    provider,
    providerId,
  }));

  const now = new Date().toISOString();
  const songId = randomUUID();

  const result = await runWrite(async (tx) => {
    const existingResult = await tx.run(
      `
      OPTIONAL MATCH (existing:Song)
      WHERE size($externalEntries) > 0
        AND any(
          entry IN $externalEntries
          WHERE existing.externalIds[entry.provider] = entry.providerId
        )
      RETURN existing
      LIMIT 1
      `,
      { externalEntries },
    );
    const existingNode = existingResult.records[0]?.get("existing") as
      | { properties: Record<string, unknown> }
      | null
      | undefined;

    let songProps: Record<string, unknown>;
    let created: boolean;

    if (existingNode) {
      const update = await tx.run(
        `
        MATCH (s:Song {id: $id})
        SET s.title = $title,
            s.updatedAt = $now,
            s.artworkUrl = coalesce($artworkUrl, s.artworkUrl),
            s.durationSec = coalesce($durationSec, s.durationSec),
            s.releaseDate = coalesce($releaseDate, s.releaseDate),
            s.bpm = coalesce($bpm, s.bpm),
            s.musicalKey = coalesce($musicalKey, s.musicalKey),
            s.energy = coalesce($energy, s.energy),
            s.libraryId = coalesce($libraryId, s.libraryId),
            s.externalIds = coalesce(s.externalIds, {}) + $externalIds
        RETURN s { .* } AS song
        `,
        {
          id: existingNode.properties.id,
          title,
          now,
          artworkUrl: input.artworkUrl ?? null,
          durationSec: input.durationSec ?? null,
          releaseDate: input.releaseDate ?? null,
          bpm: input.bpm ?? null,
          musicalKey: input.musicalKey ?? null,
          energy: input.energy ?? null,
          libraryId: input.libraryId ?? null,
          externalIds,
        },
      );
      songProps = update.records[0]?.get("song") as Record<string, unknown>;
      created = false;
    } else {
      const create = await tx.run(
        `
        CREATE (s:Song {
          id: $songId,
          title: $title,
          bpm: $bpm,
          musicalKey: $musicalKey,
          durationSec: $durationSec,
          energy: $energy,
          artworkUrl: $artworkUrl,
          releaseDate: $releaseDate,
          externalIds: $externalIds,
          libraryId: $libraryId,
          createdAt: $now,
          updatedAt: $now
        })
        RETURN s { .* } AS song
        `,
        {
          songId,
          title,
          bpm: input.bpm ?? null,
          musicalKey: input.musicalKey ?? null,
          durationSec: input.durationSec ?? null,
          energy: input.energy ?? null,
          artworkUrl: input.artworkUrl ?? null,
          releaseDate: input.releaseDate ?? null,
          externalIds,
          libraryId: input.libraryId ?? null,
          now,
        },
      );
      songProps = create.records[0]?.get("song") as Record<string, unknown>;
      created = true;
    }

    const id = String(songProps.id);

    await tx.run(
      `
      MATCH (song:Song {id: $songId})
      FOREACH (artist IN $artists |
        MERGE (a:Artist {nameNormalized: artist.nameNormalized})
        ON CREATE SET a.id = artist.id, a.name = artist.name
        MERGE (a)-[:BY]->(song)
      )
      FOREACH (genre IN $genres |
        MERGE (g:Genre {nameNormalized: genre.nameNormalized})
        ON CREATE SET g.id = genre.id, g.name = genre.name
        MERGE (song)-[:IN_GENRE]->(g)
      )
      FOREACH (subgenre IN $subgenres |
        MERGE (sg:Subgenre {nameNormalized: subgenre.nameNormalized})
        ON CREATE SET sg.id = subgenre.id, sg.name = subgenre.name
        MERGE (song)-[:IN_SUBGENRE]->(sg)
      )
      FOREACH (folder IN $folders |
        MERGE (f:Folder {nameNormalized: folder.nameNormalized})
        ON CREATE SET f.id = folder.id, f.name = folder.name, f.kind = folder.kind
        ON MATCH SET f.kind = coalesce(folder.kind, f.kind)
        MERGE (song)-[:IN_FOLDER]->(f)
      )
      `,
      { songId: id, artists, genres, subgenres, folders },
    );

    const linked = await tx.run(
      `
      MATCH (song:Song {id: $songId})
      OPTIONAL MATCH (artist:Artist)-[:BY]->(song)
      OPTIONAL MATCH (song)-[:IN_GENRE]->(genre:Genre)
      OPTIONAL MATCH (song)-[:IN_SUBGENRE]->(subgenre:Subgenre)
      OPTIONAL MATCH (song)-[:IN_FOLDER]->(folder:Folder)
      RETURN song { .* } AS song,
             collect(DISTINCT artist { .id, .name, .nameNormalized }) AS artists,
             collect(DISTINCT genre { .id, .name, .nameNormalized }) AS genres,
             collect(DISTINCT subgenre { .id, .name, .nameNormalized }) AS subgenres,
             collect(DISTINCT folder { .id, .name, .nameNormalized, .kind }) AS folders
      `,
      { songId: id },
    );

    const record = linked.records[0];
    return {
      song: asSong(record.get("song") as Record<string, unknown>),
      artists: ((record.get("artists") as GraphNamedNode[]) ?? [])
        .map((row) => asNamed(row))
        .filter((row): row is GraphNamedNode => row !== null),
      genres: ((record.get("genres") as GraphNamedNode[]) ?? [])
        .map((row) => asNamed(row))
        .filter((row): row is GraphNamedNode => row !== null),
      subgenres: ((record.get("subgenres") as GraphNamedNode[]) ?? [])
        .map((row) => asNamed(row))
        .filter((row): row is GraphNamedNode => row !== null),
      folders: ((record.get("folders") as GraphFolderNode[]) ?? [])
        .map((row) => asFolder(row))
        .filter((row): row is GraphFolderNode => row !== null),
      created,
    };
  });

  return result;
}
