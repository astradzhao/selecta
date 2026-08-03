import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.cwd(), "../..");
const envLocal = resolve(repoRoot, ".env.local");
const envFile = resolve(repoRoot, ".env");

if (existsSync(envLocal)) {
  config({ path: envLocal, quiet: true });
} else if (existsSync(envFile)) {
  config({ path: envFile, quiet: true });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for drizzle-kit. Copy .env.example to .env.local and run `pnpm db:up`.",
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
