import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Linter } from "eslint";

import { designSystemConfig } from "./ui.js";

function lint(code, { filename = "file.tsx", nativeControls = true } = {}) {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
      },
      designSystemConfig({ nativeControls }),
    ],
    { filename },
  );
}

function hasRule(messages, ruleId) {
  return messages.some((message) => message.ruleId === ruleId);
}

describe("design-system ESLint rules", () => {
  it("fails on a raw Tailwind palette class", () => {
    const messages = lint(`export const cls = "bg-zinc-900";\n`);
    assert.equal(hasRule(messages, "no-restricted-syntax"), true);
  });

  it("fails on a hex color literal in TSX", () => {
    const messages = lint(`export const color = "#ff00aa";\n`);
    assert.equal(hasRule(messages, "no-restricted-syntax"), true);
  });

  it("fails on a raw <select>", () => {
    const messages = lint(`export function F() { return <select />; }\n`);
    assert.equal(hasRule(messages, "no-restricted-syntax"), true);
  });

  it("fails on window.confirm", () => {
    const messages = lint(`window.confirm("ok");\n`, { filename: "file.ts" });
    assert.equal(hasRule(messages, "no-restricted-properties"), true);
  });

  it("allows semantic tokens and the ui Select primitive", () => {
    const messages = lint(`export const cls = "bg-background text-foreground tracking-tight";\n`, {
      nativeControls: false,
    });
    assert.equal(messages.length, 0);
  });
});
