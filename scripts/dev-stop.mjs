#!/usr/bin/env node
/**
 * Tear down local full-stack leftovers from `pnpm dev`.
 * Stops Compose Postgres and frees Next.js ports (3000 / 3001).
 * Usage: pnpm dev:stop
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const WEB_PORT = 3000;
const API_PORT = 3001;

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    stdio: options.stdio ?? "inherit",
    env: process.env,
    encoding: "utf8",
    ...options,
  });
}

function which(command) {
  const result = run(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

/** PIDs listening on a TCP port (macOS / Linux). */
function pidsListeningOn(port) {
  const result = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0 || !result.stdout?.trim()) {
    return [];
  }
  return [
    ...new Set(
      result.stdout
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => Number(part))
        .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid),
    ),
  ];
}

function stopPort(port, label) {
  const pids = pidsListeningOn(port);
  if (pids.length === 0) {
    console.log(`→ ${label} (:${port}): nothing listening`);
    return;
  }

  console.log(`→ ${label} (:${port}): stopping PID(s) ${pids.join(", ")}…`);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && pidsListeningOn(port).length > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  }

  for (const pid of pidsListeningOn(port)) {
    try {
      process.kill(pid, "SIGKILL");
      console.log(`   force-killed PID ${pid}`);
    } catch {
      /* already gone */
    }
  }
}

console.log("→ Stopping local Selecta dev stack…\n");

if (which("docker")) {
  const composeCheck = run("docker", ["compose", "version"], { stdio: "ignore" });
  if (composeCheck.status === 0) {
    console.log("→ Docker Compose: down…");
    const down = run("docker", ["compose", "down"]);
    if (down.status !== 0) {
      console.error("✖ docker compose down failed (continuing to free app ports).");
    }
  } else {
    console.log("→ Docker Compose unavailable — skipping DB shutdown.");
  }
} else {
  console.log("→ Docker unavailable — skipping DB shutdown.");
}

console.log("");
stopPort(WEB_PORT, "web");
stopPort(API_PORT, "api");

console.log("\n✓ Dev stack stopped. Run `pnpm dev` when you want it back.\n");
