import { writeCypher } from "../cypher";
import { asNamed } from "../mappers";
import { GraphWriteError, type GraphNamedNode } from "../types";
import { prepareVocab } from "./shared";

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
