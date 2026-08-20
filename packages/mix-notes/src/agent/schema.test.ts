import assert from "node:assert/strict";
import { asSchema } from "ai";
import { describe, it } from "node:test";

import { SubmissionProcessingPlanSchema } from "./schema";
import { SingleTransitionDraftSchema } from "./single-transition-schema";

function requiredKeys(schema: Record<string, unknown>): string[] {
  const required = schema.required;
  assert.ok(Array.isArray(required), "expected JSON Schema required array");
  return required as string[];
}

function propertiesKeys(schema: Record<string, unknown>): string[] {
  const properties = schema.properties;
  assert.ok(properties && typeof properties === "object", "expected JSON Schema properties");
  return Object.keys(properties as Record<string, unknown>);
}

describe("note schemas OpenAI compatibility", () => {
  it("marks every single-transition draft property as required (nullable for unknowns)", () => {
    const jsonSchema = asSchema(SingleTransitionDraftSchema).jsonSchema as Record<string, unknown>;
    const props = propertiesKeys(jsonSchema);
    const required = requiredKeys(jsonSchema);
    assert.deepEqual([...required].sort(), [...props].sort());
  });

  it("marks every resolved-plan property as required", () => {
    const jsonSchema = asSchema(SubmissionProcessingPlanSchema).jsonSchema as Record<
      string,
      unknown
    >;
    const props = propertiesKeys(jsonSchema);
    const required = requiredKeys(jsonSchema);
    assert.deepEqual([...required].sort(), [...props].sort());
  });
});
