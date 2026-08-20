import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

import { designSystemConfig } from "./ui.js";

/** Shared ESLint flat config for library packages (no Next.js). */
export const baseConfig = defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  designSystemConfig(),
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/*.tsbuildinfo",
  ]),
]);

export default baseConfig;
