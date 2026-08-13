/**
 * Isolated Postgres database for @selecta/db integration tests.
 *
 * Uses the same Compose Postgres instance as local Library (`DATABASE_URL`) but a
 * separate database name (`selecta_test` by default) so suites never leave durable
 * rows in the dogfood Library DB.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { getDb, resetDbClientForTests } from "./client";

export const DEFAULT_TEST_DATABASE_NAME = "selecta_test";

/** Application tables wiped between integration suites (not drizzle meta). */
const TRUNCATE_TABLES = [
  "note_track_links",
  "note_agent_runs",
  "note_proposals",
  "proposal_review_events",
  "note_transition_commits",
  "notes",
  "block_version_choices",
  "block_versions",
  "block_alternates",
  "block_steps",
  "blocks",
  "track_artists",
  "track_genres",
  "track_subgenres",
  "track_folders",
  "track_external_ids",
  "transitions",
  "tracks",
  "artists",
  "genres",
  "subgenres",
  "folders",
] as const;

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let prepared = false;
let prepareInFlight: Promise<boolean> | null = null;

export function databaseNameFromUrl(connectionString: string): string | null {
  try {
    const url = new URL(connectionString);
    const name = url.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

export function replaceDatabaseName(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

/**
 * Prefer explicit DATABASE_URL_TEST; otherwise derive `selecta_test` from DATABASE_URL.
 */
export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = env.DATABASE_URL_TEST?.trim();
  if (explicit) return explicit;

  const library = env.DATABASE_URL?.trim();
  if (!library) return undefined;

  return replaceDatabaseName(library, DEFAULT_TEST_DATABASE_NAME);
}

/** Refuse to run integration suites against the dogfood Library database. */
export function isSafeTestDatabaseUrl(
  testUrl: string,
  libraryUrl: string | undefined,
): { ok: true } | { ok: false; reason: string } {
  const testName = databaseNameFromUrl(testUrl);
  if (!testName) {
    return { ok: false, reason: "could not parse test database name from URL" };
  }

  if (libraryUrl?.trim()) {
    const libraryName = databaseNameFromUrl(libraryUrl);
    if (libraryName && libraryName === testName) {
      return {
        ok: false,
        reason: `test database "${testName}" matches Library DATABASE_URL; set DATABASE_URL_TEST to a different database (e.g. ${DEFAULT_TEST_DATABASE_NAME})`,
      };
    }
  }

  if (testName === "selecta" || !testName.endsWith("_test")) {
    return {
      ok: false,
      reason: `refusing database "${testName}" — use a dedicated *_test database (default ${DEFAULT_TEST_DATABASE_NAME})`,
    };
  }

  return { ok: true };
}

async function ensureDatabaseExists(testUrl: string, adminUrl: string): Promise<void> {
  const testName = databaseNameFromUrl(testUrl);
  if (!testName) {
    throw new Error("Invalid test database URL");
  }

  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const existing = await client.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [testName],
    );
    if (existing.rows[0]?.exists) return;

    // Database names cannot be parameterized; testName is validated above.
    await client.query(`CREATE DATABASE "${testName.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }
}

async function migrateTestDatabase(testUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: testUrl });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: resolve(packageRoot, "drizzle") });
  } finally {
    await pool.end();
  }
}

export async function truncateTestDatabase(): Promise<void> {
  const db = getDb();
  const list = TRUNCATE_TABLES.map((name) => `"${name}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${list} CASCADE`));
}

/**
 * Point the process at the isolated test DB, create/migrate if needed.
 * Returns false when Postgres is unavailable so unit tests still pass.
 */
export async function enableDbIntegration(): Promise<boolean> {
  if (prepared) return true;
  if (prepareInFlight) return prepareInFlight;

  prepareInFlight = (async () => {
    const libraryUrl = process.env.DATABASE_URL?.trim();
    const testUrl = resolveTestDatabaseUrl();
    if (!testUrl) return false;

    const safety = isSafeTestDatabaseUrl(testUrl, libraryUrl);
    if (!safety.ok) {
      console.warn(`[@selecta/db] Skipping Postgres integration tests: ${safety.reason}`);
      return false;
    }

    // CREATE DATABASE requires a connection to a different existing DB on the instance.
    const ensureAdminUrl = libraryUrl ?? replaceDatabaseName(testUrl, "postgres");

    try {
      await ensureDatabaseExists(testUrl, ensureAdminUrl);
      await migrateTestDatabase(testUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[@selecta/db] Skipping Postgres integration tests (test DB unavailable): ${message}`,
      );
      return false;
    }

    process.env.DATABASE_URL = testUrl;
    await resetDbClientForTests();
    await truncateTestDatabase();
    prepared = true;
    return true;
  })();

  try {
    return await prepareInFlight;
  } finally {
    if (!prepared) prepareInFlight = null;
  }
}

/** CLI / docs helper: ensure + migrate only (no truncate). */
export async function prepareTestDatabase(): Promise<string> {
  const libraryUrl = process.env.DATABASE_URL?.trim();
  const testUrl = resolveTestDatabaseUrl();
  if (!testUrl) {
    throw new Error(
      "Set DATABASE_URL_TEST or DATABASE_URL (to derive selecta_test). Copy .env.example to .env.local and run `pnpm db:up`.",
    );
  }

  const safety = isSafeTestDatabaseUrl(testUrl, libraryUrl);
  if (!safety.ok) {
    throw new Error(safety.reason);
  }

  const ensureAdminUrl = libraryUrl ?? replaceDatabaseName(testUrl, "postgres");
  await ensureDatabaseExists(testUrl, ensureAdminUrl);
  await migrateTestDatabase(testUrl);
  return testUrl;
}
