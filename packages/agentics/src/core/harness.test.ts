import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";

import { tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";

import { runBoundedAgent } from "./harness";
import {
  createAgentLogger,
  createNoopAgentLogger,
  isDevModeLoggingEnabled,
  type AgentLogEvent,
} from "./logging";

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

  it("returns a clear error when structured output is missing instead of throwing", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "searchCatalog",
            input: JSON.stringify({ queries: [{ mentionId: "m1", query: "levels" }] }),
          },
        ],
        finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      },
    });

    const result = await runBoundedAgent({
      agentName: "test",
      model,
      promptVersion: "v-test",
      promptHash: "abc123",
      instructions: "Return JSON.",
      userPrompt: "levels into love someone",
      outputSchema: OutputSchema,
      limits: { maxSteps: 1 },
      tools: {
        searchCatalog: tool({
          description: "search",
          inputSchema: z.object({
            queries: z.array(
              z.object({
                mentionId: z.string(),
                query: z.string(),
              }),
            ),
          }),
          execute: async () => ({ results: [] }),
        }),
      },
      logger: { log() {} },
    });

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "invalid_output");
    assert.match(result.error.message, /structured output|No output generated/i);
  });
});

describe("createAgentLogger", () => {
  it("is quiet unless DEV_MODE is enabled or force is set", () => {
    const previous = process.env.DEV_MODE;
    try {
      process.env.DEV_MODE = "";
      assert.equal(isDevModeLoggingEnabled(), false);

      process.env.DEV_MODE = "true";
      assert.equal(isDevModeLoggingEnabled(), true);

      const forced = createAgentLogger({ force: true });
      assert.notEqual(forced.log, createNoopAgentLogger().log);
    } finally {
      if (previous === undefined) {
        delete process.env.DEV_MODE;
      } else {
        process.env.DEV_MODE = previous;
      }
    }
  });
});
