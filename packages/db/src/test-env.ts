/**
 * Shared helpers for @selecta/db tests.
 *
 * Postgres integration suites MUST opt in with SELECTA_DB_INTEGRATION=1 so they
 * never write into the local Library DB during normal `pnpm test` / agent runs.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isPostgresConfigured } from "./client";

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
 * True only when DATABASE_URL is set AND the caller opted into live DB writes.
 * Unit tests that don't need Postgres should not call this.
 */
export function isDbIntegrationEnabled(): boolean {
  loadDbTestEnv();
  return isPostgresConfigured() && process.env.SELECTA_DB_INTEGRATION?.trim() === "1";
}
