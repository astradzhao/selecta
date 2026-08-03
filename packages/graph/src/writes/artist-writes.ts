import { writeCypher } from "../cypher";
import { asNamed } from "../mappers";
import { GraphWriteError, type GraphNamedNode } from "../types";
import { prepareVocab } from "./shared";

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
