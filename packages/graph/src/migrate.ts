import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { closeDriver } from "./client";
import { ensureConstraints } from "./constraints";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

for (const file of [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")]) {
  if (existsSync(file)) {
    config({ path: file, quiet: true });
    break;
  }
}

try {
  const result = await ensureConstraints();
  console.log(`Neo4j constraints/indexes applied (${result.applied} statements).`);
} finally {
  await closeDriver();
}
