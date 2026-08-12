/**
 * Shared helpers for @selecta/db tests.
 *
 * Postgres integration suites target an isolated `selecta_test` database on the
 * same Compose Postgres instance as Library — never the dogfood `selecta` DB.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { enableDbIntegration, truncateTestDatabase } from "./test-database";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

let loaded = false;

/** Load root .env.local / .env once (integration tests only). */
export function loadDbTestEnv(): void {
  if (loaded) return;
  loaded = true;
  for (const file of [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")]) {
    if (existsSync(file)) {
      config({ path: file, quiet: true });
      break;
    }
  }
}

/**
 * Prepare the isolated test database and point DATABASE_URL at it.
 * Returns false when Postgres / selecta_test is unavailable so unit tests still pass.
 */
export async function isDbIntegrationEnabled(): Promise<boolean> {
  loadDbTestEnv();
  return enableDbIntegration();
}

/** Wipe application tables in the active test DB between integration describes. */
export async function resetDbIntegrationData(): Promise<void> {
  await truncateTestDatabase();
}
