import { randomUUID } from "node:crypto";

import { readCypher, writeCypher } from "../cypher";
import { asFolder } from "../mappers";
import { normalizeName } from "../normalize";
import { assertFolderKind, GraphWriteError, type FolderRef, type GraphFolderNode } from "../types";
import { prepareVocab, requireTrimmed, type VocabParams } from "./shared";

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

/** Resolve a Folder ref by id and/or name for song linking. */
export async function resolveFolderRef(
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
