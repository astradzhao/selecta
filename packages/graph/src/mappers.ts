import { normalizeName } from "./normalize";
import { isFolderKind, type FolderKind } from "./schema";
import type { GraphFolderNode, GraphNamedNode, GraphSongNode, SongExternalIds } from "./types";

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

/**
 * Neo4j node properties cannot be maps — persist external ids as `provider:id` strings.
 * Provider keys must not contain `:`; provider ids may.
 */
export function encodeExternalIds(externalIds: Record<string, string>): string[] {
  return Object.entries(externalIds).map(([provider, providerId]) => `${provider}:${providerId}`);
}

export function decodeExternalIds(value: unknown): Record<string, string> {
  if (Array.isArray(value)) {
    const decoded: Record<string, string> = {};
    for (const item of value) {
      if (typeof item !== "string") continue;
      const sep = item.indexOf(":");
      if (sep <= 0) continue;
      const provider = item.slice(0, sep).trim();
      const providerId = item.slice(sep + 1).trim();
      if (provider && providerId) {
        decoded[provider] = providerId;
      }
    }
    return decoded;
  }

  // Tolerate in-memory / mistaken map shapes (not valid Neo4j property values).
  if (value && typeof value === "object") {
    const decoded: Record<string, string> = {};
    for (const [provider, providerId] of Object.entries(value as SongExternalIds)) {
      if (typeof provider === "string" && typeof providerId === "string") {
        const key = provider.trim();
        const id = providerId.trim();
        if (key && id) decoded[key] = id;
      }
    }
    return decoded;
  }

  return {};
}

export function asSong(props: Record<string, unknown>): GraphSongNode {
  return {
    id: String(props.id),
    title: String(props.title ?? ""),
    bpm: typeof props.bpm === "number" ? props.bpm : null,
    musicalKey: typeof props.musicalKey === "string" ? props.musicalKey : null,
    durationSec: typeof props.durationSec === "number" ? props.durationSec : null,
    energy: typeof props.energy === "number" ? props.energy : null,
    artworkUrl: typeof props.artworkUrl === "string" ? props.artworkUrl : null,
    releaseDate: typeof props.releaseDate === "string" ? props.releaseDate : null,
    externalIds: decodeExternalIds(props.externalIds),
    libraryId: typeof props.libraryId === "string" ? props.libraryId : null,
    createdAt: String(props.createdAt ?? ""),
    updatedAt: String(props.updatedAt ?? ""),
  };
}
