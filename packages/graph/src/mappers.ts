import { normalizeName } from "./normalize";
import { isFolderKind, type FolderKind } from "./schema";
import type { GraphFolderNode, GraphNamedNode, GraphSongNode } from "./types";

export function asNamed(row: {
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

export function asFolder(row: {
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

export function asSong(props: Record<string, unknown>): GraphSongNode {
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
