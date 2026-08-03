import neo4j, { type Driver } from "neo4j-driver";

type GlobalGraph = {
  driver?: Driver;
};

const globalForGraph = globalThis as typeof globalThis & { __selectaGraph?: GlobalGraph };

function getNeo4jConfig():
  | { configured: false }
  | { configured: true; uri: string; user: string; password: string } {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !user || !password) {
    return { configured: false };
  }

  return { configured: true, uri, user, password };
}

export function isNeo4jConfigured(): boolean {
  return getNeo4jConfig().configured;
}

/** Neo4j driver singleton (HMR-safe; suitable for Fluid Compute reuse). */
export function getDriver(): Driver {
  const existing = globalForGraph.__selectaGraph?.driver;
  if (existing) {
    return existing;
  }

  const config = getNeo4jConfig();
  if (!config.configured) {
    throw new Error(
      "NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD are required. Copy .env.example to .env.local and run `pnpm db:up`.",
    );
  }

  const driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password));
  globalForGraph.__selectaGraph = { driver };
  return driver;
}

export async function closeDriver(): Promise<void> {
  const driver = globalForGraph.__selectaGraph?.driver;
  if (!driver) {
    return;
  }
  await driver.close();
  globalForGraph.__selectaGraph = undefined;
}

export type GraphStatus = {
  configured: boolean;
  store: "neo4j";
  ok?: boolean;
  error?: string;
  latencyMs?: number;
};
