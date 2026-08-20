import { generateText, NoOutputGeneratedError, Output } from "ai";

import { createAgentLogger, type AgentLogger } from "../../core/logging";
import type { AgentUsage } from "../../core/types";

import { providerFromModel } from "./provider";
import {
  buildSingleTransitionPrompt,
  buildSingleTransitionUserPrompt,
  DEFAULT_SINGLE_TRANSITION_MODEL,
} from "./orchestrator-prompt";
import {
  SingleTransitionDraftSchema,
  type SingleTransitionDraft,
} from "./single-transition-schema";

export type ParseSingleTransitionDraftInput = {
  sourceText: string;
  model?: string;
  logger?: AgentLogger;
  runId?: string;
};

export type ParseSingleTransitionDraftSuccess = {
  ok: true;
  draft: SingleTransitionDraft;
  model: string;
  provider: string;
  promptVersion: string;
  promptHash: string;
  finishReason?: string;
  usage?: AgentUsage;
  durationMs: number;
};

export type ParseSingleTransitionDraftFailure = {
  ok: false;
  error: { code: string; message: string; retryable: boolean; details?: Record<string, unknown> };
  model: string;
  provider: string;
  promptVersion: string;
  promptHash: string;
  durationMs: number;
};

export type ParseSingleTransitionDraftResult =
  | ParseSingleTransitionDraftSuccess
  | ParseSingleTransitionDraftFailure;

function toUsage(raw: unknown): AgentUsage | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const usage = raw as Record<string, unknown>;
  return {
    inputTokens: typeof usage.inputTokens === "number" ? usage.inputTokens : undefined,
    outputTokens: typeof usage.outputTokens === "number" ? usage.outputTokens : undefined,
    totalTokens: typeof usage.totalTokens === "number" ? usage.totalTokens : undefined,
  };
}

/**
 * Cheap structured-output parse for exactly one transition span.
 * Domain-only — persistence and Neo4j writes happen in deterministic application code.
 */
export async function parseSingleTransitionDraft(
  input: ParseSingleTransitionDraftInput,
): Promise<ParseSingleTransitionDraftResult> {
  const sourceText = input.sourceText.trim();
  if (!sourceText) {
    throw new Error("sourceText is required for single-transition parse.");
  }

  const model =
    input.model?.trim() ||
    process.env.SUBMISSION_CHILD_MODEL?.trim() ||
    process.env.SUBMISSION_AGENT_MODEL?.trim() ||
    DEFAULT_SINGLE_TRANSITION_MODEL;
  const logger = input.logger ?? createAgentLogger();
  const prompt = buildSingleTransitionPrompt();
  const provider = providerFromModel(model);
  const started = Date.now();
  const runId = input.runId ?? "single-transition";

  logger.log("info", {
    type: "run_start",
    runId,
    agentName: "single-transition-parse",
    model,
    promptVersion: prompt.promptVersion,
    maxSteps: 1,
  });

  try {
    const result = await generateText({
      model,
      system: prompt.system,
      prompt: buildSingleTransitionUserPrompt(sourceText),
      output: Output.object({
        schema: SingleTransitionDraftSchema,
      }),
      maxOutputTokens: 800,
    });

    let draftUnknown: unknown;
    try {
      draftUnknown = result.output;
    } catch (error) {
      if (NoOutputGeneratedError.isInstance(error)) {
        return {
          ok: false,
          error: {
            code: "invalid_output",
            message: "No structured single-transition draft generated.",
            retryable: true,
          },
          model,
          provider,
          promptVersion: prompt.promptVersion,
          promptHash: prompt.promptHash,
          durationMs: Date.now() - started,
        };
      }
      throw error;
    }

    const parsed = SingleTransitionDraftSchema.safeParse(draftUnknown);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: "invalid_output",
          message: "Single-transition draft failed schema validation.",
          retryable: false,
          details: { issues: parsed.error.issues.slice(0, 8) },
        },
        model,
        provider,
        promptVersion: prompt.promptVersion,
        promptHash: prompt.promptHash,
        durationMs: Date.now() - started,
      };
    }

    logger.log("info", {
      type: "run_end",
      runId,
      status: "completed",
      stepCount: 1,
      toolCallCount: 0,
      finishReason: result.finishReason,
      usage: toUsage(result.usage) as Record<string, number> | undefined,
      durationMs: Date.now() - started,
    });

    return {
      ok: true,
      draft: parsed.data,
      model,
      provider,
      promptVersion: prompt.promptVersion,
      promptHash: prompt.promptHash,
      finishReason: result.finishReason,
      usage: toUsage(result.usage),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Single-transition parse failed.";
    const retryable = /timeout|rate.?limit|429|503|ECONNRESET|ETIMEDOUT/i.test(message);
    logger.log("error", {
      type: "run_end",
      runId,
      status: "failed",
      stepCount: 0,
      toolCallCount: 0,
      errorCode: "internal",
      errorMessage: message.slice(0, 500),
      durationMs: Date.now() - started,
    });
    return {
      ok: false,
      error: { code: "internal", message, retryable },
      model,
      provider,
      promptVersion: prompt.promptVersion,
      promptHash: prompt.promptHash,
      durationMs: Date.now() - started,
    };
  }
}
