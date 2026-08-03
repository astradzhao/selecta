import { readCypher, writeCypher } from "../cypher";
import { asNamed } from "../mappers";
import { GraphWriteError, type GraphNamedNode, type NamedRef } from "../types";
import { prepareVocab, type VocabParams } from "./shared";

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

/** Resolve a Subgenre ref by id and/or name for song linking. */
export async function resolveSubgenreRef(ref: NamedRef, label: string): Promise<VocabParams> {
  const id = ref.id?.trim();
  const name = ref.name?.trim();
  if (!id && !name) {
    throw new GraphWriteError("invalid_input", `${label} requires an id or name.`);
  }

  if (id) {
    const rows = await readCypher<{ n: GraphNamedNode }>(
      `
      MATCH (n:Subgenre {id: $id})
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
