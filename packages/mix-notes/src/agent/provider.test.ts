import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { providerFromModel } from "./provider";

describe("providerFromModel", () => {
  it("derives provider from AI Gateway model ids", () => {
    assert.equal(providerFromModel("openai/gpt-5.4-mini"), "openai");
    assert.equal(providerFromModel("anthropic/claude-sonnet-4-5"), "anthropic");
    assert.equal(providerFromModel("bare-model"), "unknown");
  });
});
