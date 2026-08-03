import { randomUUID } from "node:crypto";

import { asFolder, asNamed, asTrack, decodeExternalIds, encodeExternalIds } from "../mappers";
import {
  GraphWriteError,
  type CreateTrackInput,
  type CreateTrackResult,
  type GraphFolderNode,
  type GraphNamedNode,
} from "../types";
import { resolveFolderRef } from "./folder-writes";
import { cleanExternalIds, prepareVocab, requireTrimmed, runWrite } from "./shared";
import { resolveSubgenreRef } from "./subgenre-writes";

/**
 * Create a Track (or reuse one matched by external provider id) and wire
 * Artist / Genre / Subgenre / Folder relationships.
 *
 * Genre = provider metadata; Subgenre = DJ musical label; Folder = playlist/folder.
 * Title + ≥1 artist required; genres/subgenres/folders optional.
 *
 * `externalIds` are stored on the Track as a string array (`provider:id`) because
 * Neo4j node properties cannot be maps.
 */
export async function createTrack(input: CreateTrackInput): Promise<CreateTrackResult> {
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
    (input.subgenres ?? []).map((ref, index) => resolveSubgenreRef(ref, `subgenres[${index}]`)),
  );
  const folders = await Promise.all((input.folders ?? []).map(resolveFolderRef));
  const externalIds = cleanExternalIds(input.externalIds);
  const externalIdEntries = encodeExternalIds(externalIds);

  const now = new Date().toISOString();
  const trackId = randomUUID();

  return runWrite(async (tx) => {
    const existingResult = await tx.run(
      `
      OPTIONAL MATCH (existing:Track)
      WHERE size($externalIdEntries) > 0
        AND any(
          entry IN $externalIdEntries
          WHERE entry IN coalesce(existing.externalIds, [])
        )
      RETURN existing
      LIMIT 1
      `,
      { externalIdEntries },
    );
    const existingNode = existingResult.records[0]?.get("existing") as
      | { properties: Record<string, unknown> }
      | null
      | undefined;

    let trackProps: Record<string, unknown>;
    let created: boolean;

    if (existingNode) {
      const existingIds = decodeExternalIds(existingNode.properties.externalIds);
      const mergedIds = encodeExternalIds({ ...existingIds, ...externalIds });
      const update = await tx.run(
        `
        MATCH (s:Track {id: $id})
        SET s.title = $title,
            s.updatedAt = $now,
            s.artworkUrl = coalesce($artworkUrl, s.artworkUrl),
            s.durationSec = coalesce($durationSec, s.durationSec),
            s.releaseDate = coalesce($releaseDate, s.releaseDate),
            s.bpm = coalesce($bpm, s.bpm),
            s.musicalKey = coalesce($musicalKey, s.musicalKey),
            s.energy = coalesce($energy, s.energy),
            s.libraryId = coalesce($libraryId, s.libraryId),
            s.externalIds = $externalIds
        RETURN s { .* } AS track
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
          externalIds: mergedIds,
        },
      );
      trackProps = update.records[0]?.get("track") as Record<string, unknown>;
      created = false;
    } else {
      const create = await tx.run(
        `
        CREATE (s:Track {
          id: $trackId,
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
        RETURN s { .* } AS track
        `,
        {
          trackId,
          title,
          bpm: input.bpm ?? null,
          musicalKey: input.musicalKey ?? null,
          durationSec: input.durationSec ?? null,
          energy: input.energy ?? null,
          artworkUrl: input.artworkUrl ?? null,
          releaseDate: input.releaseDate ?? null,
          externalIds: externalIdEntries,
          libraryId: input.libraryId ?? null,
          now,
        },
      );
      trackProps = create.records[0]?.get("track") as Record<string, unknown>;
      created = true;
    }

    const id = String(trackProps.id);

    await tx.run(
      `
      MATCH (track:Track {id: $trackId})
      FOREACH (artist IN $artists |
        MERGE (a:Artist {nameNormalized: artist.nameNormalized})
        ON CREATE SET a.id = artist.id, a.name = artist.name
        MERGE (a)-[:BY]->(track)
      )
      FOREACH (genre IN $genres |
        MERGE (g:Genre {nameNormalized: genre.nameNormalized})
        ON CREATE SET g.id = genre.id, g.name = genre.name
        MERGE (track)-[:IN_GENRE]->(g)
      )
      FOREACH (subgenre IN $subgenres |
        MERGE (sg:Subgenre {nameNormalized: subgenre.nameNormalized})
        ON CREATE SET sg.id = subgenre.id, sg.name = subgenre.name
        MERGE (track)-[:IN_SUBGENRE]->(sg)
      )
      FOREACH (folder IN $folders |
        MERGE (f:Folder {nameNormalized: folder.nameNormalized})
        ON CREATE SET f.id = folder.id, f.name = folder.name, f.kind = folder.kind
        ON MATCH SET f.kind = coalesce(folder.kind, f.kind)
        MERGE (track)-[:IN_FOLDER]->(f)
      )
      `,
      { trackId: id, artists, genres, subgenres, folders },
    );

    const linked = await tx.run(
      `
      MATCH (track:Track {id: $trackId})
      OPTIONAL MATCH (artist:Artist)-[:BY]->(track)
      OPTIONAL MATCH (track)-[:IN_GENRE]->(genre:Genre)
      OPTIONAL MATCH (track)-[:IN_SUBGENRE]->(subgenre:Subgenre)
      OPTIONAL MATCH (track)-[:IN_FOLDER]->(folder:Folder)
      RETURN track { .* } AS track,
             collect(DISTINCT artist { .id, .name, .nameNormalized }) AS artists,
             collect(DISTINCT genre { .id, .name, .nameNormalized }) AS genres,
             collect(DISTINCT subgenre { .id, .name, .nameNormalized }) AS subgenres,
             collect(DISTINCT folder { .id, .name, .nameNormalized, .kind }) AS folders
      `,
      { trackId: id },
    );

    const record = linked.records[0];
    return {
      track: asTrack(record.get("track") as Record<string, unknown>),
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
}
