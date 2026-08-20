import type { FolderKind, Track, TrackExternalId } from "@selecta/db/schema";
import { isFolderKind } from "./constants";
import type { FolderNode, NamedNode, TrackNode } from "./types";

export function toNamedNode(row: { id: string; name: string; nameNormalized: string }): NamedNode {
  return {
    id: row.id,
    name: row.name,
    nameNormalized: row.nameNormalized,
  };
}

export function toFolderNode(row: {
  id: string;
  name: string;
  nameNormalized: string;
  kind: FolderKind | null;
}): FolderNode {
  return {
    id: row.id,
    name: row.name,
    nameNormalized: row.nameNormalized,
    kind: row.kind !== null && isFolderKind(row.kind) ? row.kind : null,
  };
}

export function externalIdsToMap(rows: TrackExternalId[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.provider] = row.providerId;
  }
  return map;
}

export function toTrackNode(row: Track, externalIds: Record<string, string>): TrackNode {
  return {
    id: row.id,
    title: row.title,
    bpm: row.bpm ?? null,
    musicalKey: row.musicalKey ?? null,
    durationSec: row.durationSec ?? null,
    energy: row.energy ?? null,
    artworkUrl: row.artworkUrl ?? null,
    releaseDate: row.releaseDate ?? null,
    externalIds,
    libraryId: row.libraryId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
