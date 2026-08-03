/**
 * Load monorepo-root dotenv files into process.env.
 * Next.js only auto-loads env files from each app directory.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @param {string} repoRoot
 * @returns {string | null} path of the file that was loaded, if any
 */
export function loadRootEnv(repoRoot) {
  for (const name of [".env.local", ".env"]) {
    const filePath = resolve(repoRoot, name);
    if (!existsSync(filePath)) continue;

    const text = readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;

      const key = trimmed.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    return filePath;
  }

  return null;
}
