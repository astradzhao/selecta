import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@selecta/db", "@selecta/graph", "@selecta/notes", "@selecta/ui"],
};

export default nextConfig;
