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
  async redirects() {
    return [
      {
        source: "/notes",
        destination: "/library?view=submissions",
        permanent: false,
      },
      {
        // Keep /notes/new handled below; do not treat "new" as a submission id.
        source: "/notes/:id((?!new$)[^/]+)",
        destination: "/library/submissions/:id",
        permanent: false,
      },
      {
        source: "/notes/new",
        destination: "/add?mode=transition",
        permanent: false,
      },
      {
        source: "/tracks/new",
        destination: "/add?mode=track",
        permanent: false,
      },
      {
        source: "/songs/new",
        destination: "/add?mode=track",
        permanent: false,
      },
    ];
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
