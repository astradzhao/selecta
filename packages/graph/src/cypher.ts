import neo4j from "neo4j-driver";

import { getDriver, isNeo4jConfigured, type GraphStatus } from "./client";

export type CypherParams = Record<string, unknown>;

/**
 * Run parameterized Cypher and return record objects.
 * Never interpolate user input into the query string — always pass `params`.
 */
async function runParameterized<T = unknown>(
  cypher: string,
  params: CypherParams,
  accessMode: "READ" | "WRITE",
): Promise<T[]> {
  const session = getDriver().session({
    defaultAccessMode: accessMode === "READ" ? neo4j.session.READ : neo4j.session.WRITE,
  });
  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => record.toObject() as T);
  } finally {
    await session.close();
  }
}

/** Read-only Cypher (Live Mode / search). */
export function readCypher<T = unknown>(cypher: string, params: CypherParams = {}): Promise<T[]> {
  return runParameterized<T>(cypher, params, "READ");
}

/** Write Cypher (MERGE / CREATE / constraint DDL). */
export function writeCypher<T = unknown>(cypher: string, params: CypherParams = {}): Promise<T[]> {
  return runParameterized<T>(cypher, params, "WRITE");
}

export async function getGraphStatus(): Promise<GraphStatus> {
  if (!isNeo4jConfigured()) {
    return { configured: false, store: "neo4j" };
  }

  const started = performance.now();
  try {
    await readCypher("RETURN 1 AS ok");
    return {
      configured: true,
      store: "neo4j",
      ok: true,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      configured: true,
      store: "neo4j",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
