import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadRootEnv } from "../../scripts/load-root-env.mjs";

// Monorepo root `.env.local` (Next only auto-loads env files from this app dir).
loadRootEnv(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));

const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@selecta/db", "@selecta/graph", "@selecta/mix-notes", "@selecta/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/image/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
