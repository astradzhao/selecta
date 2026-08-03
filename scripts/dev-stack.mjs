#!/usr/bin/env node
/**
 * Local full-stack boot: Docker DBs → migrate → web + api.
 * Usage: pnpm dev
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envLocal = resolve(root, ".env.local");

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function which(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: root,
    stdio: "ignore",
  });
  return result.status === 0;
}

console.log("→ Checking prerequisites…");

if (!existsSync(envLocal)) {
  fail("Missing .env.local. Copy .env.example → .env.local first:\n   cp .env.example .env.local");
}

if (!which("docker")) {
  fail("Docker is not available. Install/start Docker Desktop, then retry `pnpm dev`.");
}

const composeCheck = spawnSync("docker", ["compose", "version"], {
  cwd: root,
  stdio: "ignore",
});
if (composeCheck.status !== 0) {
  fail("Docker Compose is not available (`docker compose version` failed).");
}

console.log("→ Starting Postgres + Neo4j (docker compose up -d --wait)…");
run("docker", ["compose", "up", "-d", "--wait"]);

console.log("→ Applying Postgres migrations…");
run("pnpm", ["db:migrate"]);

console.log("→ Applying Neo4j constraints/indexes…");
run("pnpm", ["graph:migrate"]);

console.log("→ Starting web (:3000) + api (:3001)…");
console.log("   Library UI: http://localhost:3000/library\n");

const child = spawn(
  "pnpm",
  ["run", "--parallel", "--filter", "@selecta/web", "--filter", "@selecta/api", "dev"],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

function shutdown(signal) {
  if (!child.killed) {
    child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(0);
  }
  process.exit(code ?? 1);
});
