import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import { clampAgentLimits, DEFAULT_AGENT_LIMITS } from "./limits";
import { composeAgentSystemPrompt, stableStringify } from "./prompt";

describe("agentics limits", () => {
  it("rejects maxSteps above 4", () => {
    assert.throws(() => clampAgentLimits({ maxSteps: 5 }), /cannot exceed 4/);
  });

  it("merges defaults", () => {
    const limits = clampAgentLimits({ maxToolCalls: 3 });
    assert.equal(limits.maxSteps, DEFAULT_AGENT_LIMITS.maxSteps);
    assert.equal(limits.maxToolCalls, 3);
  });
});

describe("composeAgentSystemPrompt", () => {
  it("embeds JSON schema derived from the Zod output schema", () => {
    const schema = z.object({
      noteType: z.enum(["unknown", "transition"]),
      confidence: z.number().min(0).max(1),
    });
    const composed = composeAgentSystemPrompt({
      promptVersion: "v1",
      sections: [
        { id: "identity", title: "Identity", body: "You are a test agent." },
        { id: "rules", title: "Rules", body: "Do not invent ids." },
      ],
      outputSchema: schema,
    });

    assert.equal(composed.promptVersion, "v1");
    assert.match(composed.promptHash, /^[a-f0-9]{16}$/);
    assert.match(composed.system, /## Identity/);
    assert.match(composed.system, /## Output JSON Schema/);
    assert.match(composed.system, /noteType/);
    assert.match(composed.system, /confidence/);
  });

  it("stableStringify sorts object keys", () => {
    assert.equal(stableStringify({ b: 1, a: 2 }), '{\n  "a": 2,\n  "b": 1\n}');
  });
});
