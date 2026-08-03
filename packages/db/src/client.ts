import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

type GlobalDb = {
  pool?: pg.Pool;
  db?: Db;
};

const globalForDb = globalThis as typeof globalThis & { __selectaDb?: GlobalDb };

function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

export function isPostgresConfigured(): boolean {
  return Boolean(getDatabaseUrl()?.trim());
}

function getPool(): pg.Pool {
  const existing = globalForDb.__selectaDb?.pool;
  if (existing) {
    return existing;
  }

  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and run `pnpm db:up`.",
    );
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  globalForDb.__selectaDb = { ...globalForDb.__selectaDb, pool };
  return pool;
}

/** Drizzle client bound to the app schema (module singleton; HMR-safe). */
export function getDb(): Db {
  const existing = globalForDb.__selectaDb?.db;
  if (existing) {
    return existing;
  }

  const pool = getPool();
  const db = drizzle(pool, { schema });
  globalForDb.__selectaDb = { pool, db };
  return db;
}

export type DbStatus = {
  configured: boolean;
  store: "postgres";
  ok?: boolean;
  error?: string;
  latencyMs?: number;
};

export async function getDbStatus(): Promise<DbStatus> {
  if (!getDatabaseUrl()) {
    return { configured: false, store: "postgres" };
  }

  const started = performance.now();
  try {
    await getDb().execute(sql`SELECT 1`);
    return {
      configured: true,
      store: "postgres",
      ok: true,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      configured: true,
      store: "postgres",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
