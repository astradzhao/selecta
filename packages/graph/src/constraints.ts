import { writeCypher } from "./cypher";

/**
 * Idempotent Neo4j constraints + indexes (ARCHITECTURE §6.3).
 * Cue property indexes deferred until cues are in MVP use.
 */
export const GRAPH_SCHEMA_STATEMENTS = [
  // Uniqueness — node ids
  "CREATE CONSTRAINT track_id IF NOT EXISTS FOR (n:Track) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT artist_id IF NOT EXISTS FOR (n:Artist) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT genre_id IF NOT EXISTS FOR (n:Genre) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT subgenre_id IF NOT EXISTS FOR (n:Subgenre) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT folder_id IF NOT EXISTS FOR (n:Folder) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT cue_id IF NOT EXISTS FOR (n:Cue) REQUIRE n.id IS UNIQUE",
  // Uniqueness — shared vocabulary / DJ-owned labels
  "CREATE CONSTRAINT artist_name_normalized IF NOT EXISTS FOR (n:Artist) REQUIRE n.nameNormalized IS UNIQUE",
  "CREATE CONSTRAINT genre_name_normalized IF NOT EXISTS FOR (n:Genre) REQUIRE n.nameNormalized IS UNIQUE",
  "CREATE CONSTRAINT subgenre_name_normalized IF NOT EXISTS FOR (n:Subgenre) REQUIRE n.nameNormalized IS UNIQUE",
  "CREATE CONSTRAINT folder_name_normalized IF NOT EXISTS FOR (n:Folder) REQUIRE n.nameNormalized IS UNIQUE",
  // Indexes — Track lookup
  "CREATE INDEX track_title IF NOT EXISTS FOR (n:Track) ON (n.title)",
  "CREATE INDEX track_bpm IF NOT EXISTS FOR (n:Track) ON (n.bpm)",
  // Uniqueness — TRANSITION edge identity (DJ-73)
  "CREATE CONSTRAINT transition_id IF NOT EXISTS FOR ()-[r:TRANSITION]-() REQUIRE r.id IS UNIQUE",
  // Indexes — TRANSITION filters (Live Mode) + AI idempotency lookup
  "CREATE INDEX transition_intent IF NOT EXISTS FOR ()-[r:TRANSITION]-() ON (r.intent)",
  "CREATE INDEX transition_technique IF NOT EXISTS FOR ()-[r:TRANSITION]-() ON (r.technique)",
  "CREATE INDEX transition_proposal_key IF NOT EXISTS FOR ()-[r:TRANSITION]-() ON (r.proposalKey)",
] as const;

export type EnsureConstraintsResult = {
  applied: number;
  statements: readonly string[];
};

export async function ensureConstraints(): Promise<EnsureConstraintsResult> {
  for (const statement of GRAPH_SCHEMA_STATEMENTS) {
    await writeCypher(statement);
  }
  return {
    applied: GRAPH_SCHEMA_STATEMENTS.length,
    statements: GRAPH_SCHEMA_STATEMENTS,
  };
}
