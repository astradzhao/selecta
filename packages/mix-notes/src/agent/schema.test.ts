import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { asSchema } from "ai";

import { NoteProcessingPlanSchema } from "./schema";

function assertOpenAiCompatibleObjectSchema(schema: Record<string, unknown>, path: string): void {
  assert.equal(schema.type, "object", `${path} must be an object`);
  const properties = schema.properties as Record<string, unknown> | undefined;
  assert.ok(properties, `${path} must define properties`);
  const required = schema.required as string[] | undefined;
  assert.ok(Array.isArray(required), `${path} must define required`);
  const propertyKeys = Object.keys(properties).sort();
  assert.deepEqual(
    [...required].sort(),
    propertyKeys,
    `${path} required must include every properties key (OpenAI structured outputs)`,
  );

  for (const [key, value] of Object.entries(properties)) {
    if (!value || typeof value !== "object") continue;
    const nested = value as Record<string, unknown>;
    if (nested.type === "object") {
      assertOpenAiCompatibleObjectSchema(nested, `${path}.${key}`);
    }
    if (nested.type === "array" && nested.items && typeof nested.items === "object") {
      const items = nested.items as Record<string, unknown>;
      if (items.type === "object") {
        assertOpenAiCompatibleObjectSchema(items, `${path}.${key}.items`);
      }
    }
    if (Array.isArray(nested.anyOf)) {
      for (const [index, option] of nested.anyOf.entries()) {
        if (
          option &&
          typeof option === "object" &&
          (option as { type?: string }).type === "object"
        ) {
          assertOpenAiCompatibleObjectSchema(
            option as Record<string, unknown>,
            `${path}.${key}.anyOf[${index}]`,
          );
        }
      }
    }
  }
}

describe("NoteProcessingPlanSchema OpenAI compatibility", () => {
  it("marks every object property as required (nullable for unknowns)", () => {
    const jsonSchema = asSchema(NoteProcessingPlanSchema).jsonSchema as Record<string, unknown>;
    assertOpenAiCompatibleObjectSchema(jsonSchema, "NoteProcessingPlan");
  });

  it("accepts null for formerly optional mention fields", () => {
    const parsed = NoteProcessingPlanSchema.parse({
      noteType: "unknown",
      mentions: [
        {
          mentionId: "m1",
          mention: "levels",
          titleHint: null,
          artistHint: null,
          selectedCandidateId: null,
          resolutionStatus: "unresolved",
          confidence: null,
          ambiguityReason: null,
        },
      ],
      transitions: [],
      confidence: 0.2,
      ambiguities: [],
    });
    assert.equal(parsed.mentions[0]?.titleHint, null);
  });
});
