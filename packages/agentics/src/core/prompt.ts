import { createHash } from "node:crypto";

import { asSchema, type FlexibleSchema } from "ai";

export type PromptSection = {
  id: string;
  title: string;
  body: string;
};

export type ComposedPrompt = {
  system: string;
  promptVersion: string;
  promptHash: string;
  sections: PromptSection[];
};

/**
 * Compose a stable system prompt from ordered sections.
 * JSON Schema for the output contract is derived from the same Zod schema used at runtime.
 */
export function composeAgentSystemPrompt(input: {
  promptVersion: string;
  sections: PromptSection[];
  outputSchema: FlexibleSchema<unknown>;
  outputSchemaTitle?: string;
}): ComposedPrompt {
  const schemaTitle = input.outputSchemaTitle ?? "Output JSON Schema";
  const jsonSchema = asSchema(input.outputSchema).jsonSchema;
  const schemaSection: PromptSection = {
    id: "output-schema",
    title: schemaTitle,
    body: [
      "Return a single JSON object matching this schema:",
      "```json",
      stableStringify(jsonSchema),
      "```",
    ].join("\n"),
  };

  const sections = [...input.sections, schemaSection];
  const system = sections
    .map((section) => `## ${section.title}\n\n${section.body.trim()}`)
    .join("\n\n");

  const promptHash = createHash("sha256")
    .update(`${input.promptVersion}\n${system}`)
    .digest("hex")
    .slice(0, 16);

  return {
    system,
    promptVersion: input.promptVersion,
    promptHash,
    sections,
  };
}

/** Deterministic JSON stringify for schema embedding / hashing. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([key, nested]) => [key, sortKeys(nested)]));
  }
  return value;
}
