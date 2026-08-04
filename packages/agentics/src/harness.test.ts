import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import { MockLanguageModelV4 } from "ai/test";

import { runBoundedAgent } from "./harness";
import type { AgentLogEvent } from "./logging";

const OutputSchema = z.object({
  noteType: z.enum(["unknown", "song_note", "transition"]),
  confidence: z.number(),
});

function mockGenerateResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 12, noCache: 12, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 8, text: 8, reasoning: undefined },
    },
    warnings: [],
  };
}

describe("runBoundedAgent", () => {
  it("completes a one-step structured output run", async () => {
    const events: AgentLogEvent[] = [];
    const model = new MockLanguageModelV4({
      doGenerate: mockGenerateResult(JSON.stringify({ noteType: "unknown", confidence: 0.4 })),
    });

    const result = await runBoundedAgent({
      agentName: "test",
      model,
      promptVersion: "v-test",
      promptHash: "abc123",
      instructions: "Return JSON.",
      userPrompt: "no songs here",
      outputSchema: OutputSchema,
      logger: {
        log(_level, event) {
          events.push(event);
        },
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.output.noteType, "unknown");
    assert.ok(events.some((event) => event.type === "run_start"));
    assert.ok(events.some((event) => event.type === "run_end" && event.status === "completed"));
  });

  it("fails when the user prompt exceeds the input character limit", async () => {
    const result = await runBoundedAgent({
      agentName: "test",
      model: "openai/gpt-4.1-mini",
      promptVersion: "v-test",
      promptHash: "abc123",
      instructions: "Return JSON.",
      userPrompt: "x".repeat(5000),
      outputSchema: OutputSchema,
      limits: { maxInputCharacters: 100 },
      logger: { log() {} },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "limit_exceeded");
  });

  it("does not include raw user prompt text in logger events", async () => {
    const serialized: string[] = [];
    const secret = "SECRET_NOTE_TEXT_SHOULD_NOT_APPEAR";
    const model = new MockLanguageModelV4({
      doGenerate: mockGenerateResult(JSON.stringify({ noteType: "unknown", confidence: 0.1 })),
    });

    await runBoundedAgent({
      agentName: "test",
      model,
      promptVersion: "v-test",
      promptHash: "abc123",
      instructions: "Return JSON.",
      userPrompt: secret,
      outputSchema: OutputSchema,
      logger: {
        log(_level, event) {
          serialized.push(JSON.stringify(event));
        },
      },
    });

    assert.ok(serialized.every((line) => !line.includes(secret)));
  });
});
