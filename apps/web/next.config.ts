import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dj/db", "@dj/graph", "@dj/notes", "@dj/ui"],
};

export default nextConfig;
