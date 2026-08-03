import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@selecta/db", "@selecta/graph", "@selecta/notes"],
};

export default nextConfig;
