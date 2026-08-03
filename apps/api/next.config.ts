import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRootEnv } from "../../scripts/load-root-env.mjs";

// Monorepo root `.env.local` (Next only auto-loads env files from this app dir).
loadRootEnv(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));

const nextConfig: NextConfig = {
  transpilePackages: ["@selecta/catalog", "@selecta/db", "@selecta/graph", "@selecta/mix-notes"],
};

export default nextConfig;
