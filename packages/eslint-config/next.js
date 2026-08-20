import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

import { designSystemConfig } from "./ui.js";

/** Shared ESLint flat config for Next.js apps. */
export const nextConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  designSystemConfig({ nativeControls: true }),
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "next-env.d.ts",
  ]),
]);

export default nextConfig;
