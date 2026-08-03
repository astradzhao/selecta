import { runCypher } from "./client";

/**
 * Idempotent Neo4j constraints + indexes (ARCHITECTURE §6.3).
 * Cue property indexes deferred until cues are in MVP use.
 */
export const GRAPH_SCHEMA_STATEMENTS = [
  // Uniqueness — node ids
  "CREATE CONSTRAINT song_id IF NOT EXISTS FOR (n:Song) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT artist_id IF NOT EXISTS FOR (n:Artist) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT genre_id IF NOT EXISTS FOR (n:Genre) REQUIRE n.id IS UNIQUE",
  "CREATE CONSTRAINT cue_id IF NOT EXISTS FOR (n:Cue) REQUIRE n.id IS UNIQUE",
  // Uniqueness — shared vocabulary
  "CREATE CONSTRAINT artist_name_normalized IF NOT EXISTS FOR (n:Artist) REQUIRE n.nameNormalized IS UNIQUE",
  "CREATE CONSTRAINT genre_name_normalized IF NOT EXISTS FOR (n:Genre) REQUIRE n.nameNormalized IS UNIQUE",
  // Indexes — Song lookup
  "CREATE INDEX song_title IF NOT EXISTS FOR (n:Song) ON (n.title)",
  "CREATE INDEX song_bpm IF NOT EXISTS FOR (n:Song) ON (n.bpm)",
  // Indexes — TRANSITION filters (Live Mode)
  "CREATE INDEX transition_intent IF NOT EXISTS FOR ()-[r:TRANSITION]-() ON (r.intent)",
  "CREATE INDEX transition_technique IF NOT EXISTS FOR ()-[r:TRANSITION]-() ON (r.technique)",
] as const;

export type EnsureConstraintsResult = {
  applied: number;
  statements: readonly string[];
};

export async function ensureConstraints(): Promise<EnsureConstraintsResult> {
  for (const statement of GRAPH_SCHEMA_STATEMENTS) {
    await runCypher(statement, {}, "WRITE");
  }
  return {
    applied: GRAPH_SCHEMA_STATEMENTS.length,
    statements: GRAPH_SCHEMA_STATEMENTS,
  };
}
