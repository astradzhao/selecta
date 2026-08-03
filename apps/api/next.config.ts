import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@selecta/db", "@selecta/graph", "@selecta/mix-notes"],
};

export default nextConfig;
