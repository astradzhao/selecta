import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");

for (const file of [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")]) {
  if (existsSync(file)) {
    config({ path: file, quiet: true });
    break;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required. Copy .env.example to .env.local and run `pnpm db:up`.");
  process.exit(1);
}

const migrationsFolder = resolve(packageRoot, "drizzle");

const pool = new pg.Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder });
  console.log("Postgres migrations applied.");
} finally {
  await pool.end();
}
