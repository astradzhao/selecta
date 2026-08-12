/**
 * Ensure the isolated integration-test database exists and is migrated.
 *
 * Usage: `pnpm db:test:prepare` (from repo root) or
 * `pnpm --filter @selecta/db db:test:prepare`.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareTestDatabase } from "./test-database";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

for (const file of [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")]) {
  if (existsSync(file)) {
    config({ path: file, quiet: true });
    break;
  }
}

try {
  const testUrl = await prepareTestDatabase();
  const safe = testUrl.replace(/:[^:@/]+@/, ":***@");
  console.log(`Test database ready: ${safe}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
