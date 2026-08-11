#!/usr/bin/env node
/**
 * Local full-stack boot: Docker Postgres → migrate → web + api.
 * Usage: pnpm dev
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { loadRootEnv } from "./load-root-env.mjs";

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

loadRootEnv(root);

// Detect half-linked installs: virtual store present but workspace package bins missing.
// Common after interrupted/sandbox `pnpm install` (CI=true / alternate PNPM_STORE_PATH).
const dbTsxBin = resolve(root, "packages/db/node_modules/.bin/tsx");
const pnpmVirtualStore = resolve(root, "node_modules/.pnpm");
if (!existsSync(dbTsxBin)) {
  if (existsSync(pnpmVirtualStore)) {
    fail(
      "node_modules looks incomplete (missing packages/db/.bin/tsx).\n" +
        "   Fix: rm -rf node_modules .pnpm-store && pnpm install\n" +
        "   Tip: run that in a normal terminal; CI=true / alternate PNPM_STORE_PATH can leave a half-linked tree.",
    );
  }
  fail("Dependencies not installed. Run `pnpm install`, then retry `pnpm dev`.");
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

console.log("→ Starting Postgres (docker compose up -d --wait)…");
run("docker", ["compose", "up", "-d", "--wait"]);

console.log("→ Applying Postgres migrations…");
run("pnpm", ["db:migrate"]);

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
