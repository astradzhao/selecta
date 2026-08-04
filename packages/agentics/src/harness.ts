import { randomUUID } from "node:crypto";

import { generateText, isStepCount, Output, type PrepareStepFunction, type ToolSet } from "ai";
import type { z } from "zod";

import { AgentError } from "./errors";
import { clampAgentLimits } from "./limits";
import { createConsoleAgentLogger, type AgentLogger } from "./logging";
import type { AgentUsage, BoundedAgentResult, RunBoundedAgentInput } from "./types";

function modelLabel(model: import("ai").LanguageModel): string {
  if (typeof model === "string") {
    return model;
  }
  if (model && typeof model === "object") {
    const maybeId = (model as { modelId?: unknown }).modelId;
    if (typeof maybeId === "string" && maybeId) {
      return maybeId;
    }
  }
  return "language-model";
}

function countToolCalls(steps: Array<{ toolCalls?: unknown[] }>): number {
  return steps.reduce((sum, step) => sum + (step.toolCalls?.length ?? 0), 0);
}

function toUsage(raw: unknown): AgentUsage | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const usage = raw as Record<string, unknown>;
  return {
    inputTokens: typeof usage.inputTokens === "number" ? usage.inputTokens : undefined,
    outputTokens: typeof usage.outputTokens === "number" ? usage.outputTokens : undefined,
    totalTokens: typeof usage.totalTokens === "number" ? usage.totalTokens : undefined,
  };
}

function defaultPrepareStep<TOOLS extends ToolSet>(
  maxToolSteps: number,
): PrepareStepFunction<TOOLS, Record<string, never>> {
  return ({ stepNumber }) => {
    if (stepNumber >= maxToolSteps) {
      return {
        activeTools: [] as Array<keyof TOOLS & string>,
        toolChoice: "none" as const,
      };
    }
    return {};
  };
}

/**
 * Run a bounded tool-loop generation with structured output, step/tool/time limits,
 * and structured logging. Domain-neutral — callers supply tools and schemas.
 *
 * Uses AI SDK `generateText` with `stopWhen: isStepCount(N)` (same loop semantics as
 * ToolLoopAgent) for stable typing with injected tool sets.
 */
export async function runBoundedAgent<TOutput, TOOLS extends ToolSet = ToolSet>(
  input: RunBoundedAgentInput<TOutput, TOOLS>,
): Promise<BoundedAgentResult<TOutput>> {
  const limits = clampAgentLimits(input.limits);
  const logger: AgentLogger = input.logger ?? createConsoleAgentLogger();
  const runId = input.runId ?? randomUUID();
  const started = Date.now();
  const modelId = modelLabel(input.model);
  let stepCount = 0;
  let toolCallCount = 0;

  if (input.userPrompt.length > limits.maxInputCharacters) {
    return {
      ok: false,
      error: {
        code: "limit_exceeded",
        message: `User prompt exceeds maxInputCharacters (${limits.maxInputCharacters}).`,
      },
      stepCount: 0,
      toolCallCount: 0,
      promptVersion: input.promptVersion,
      promptHash: input.promptHash,
      model: modelId,
      durationMs: Date.now() - started,
    };
  }

  logger.log("info", {
    type: "run_start",
    runId,
    agentName: input.agentName,
    model: modelId,
    promptVersion: input.promptVersion,
    maxSteps: limits.maxSteps,
  });

  const tools = (input.tools ?? {}) as TOOLS;
  const prepareStep =
    input.prepareStep ?? defaultPrepareStep<TOOLS>(Math.min(2, Math.max(1, limits.maxSteps - 1)));

  try {
    const result = await generateText({
      model: input.model,
      system: input.instructions,
      prompt: input.userPrompt,
      tools,
      output: Output.object({
        schema: input.outputSchema as z.ZodType<TOutput>,
      }),
      stopWhen: isStepCount(limits.maxSteps),
      maxOutputTokens: limits.maxOutputTokens,
      prepareStep,
      timeout: {
        totalMs: limits.totalMs,
        stepMs: limits.stepMs,
        toolMs: limits.toolMs,
      },
      onStepStart: (event) => {
        const stepNumber =
          typeof (event as { stepNumber?: number }).stepNumber === "number"
            ? (event as { stepNumber: number }).stepNumber
            : stepCount;
        stepCount = Math.max(stepCount, stepNumber + 1);
        logger.log("debug", { type: "step_start", runId, stepNumber });
      },
      onToolExecutionStart: (event) => {
        const toolName = String((event as { toolName?: string }).toolName ?? "unknown");
        logger.log("debug", {
          type: "tool_start",
          runId,
          stepNumber: stepCount,
          toolName,
        });
      },
      onToolExecutionEnd: (event) => {
        toolCallCount += 1;
        const toolName = String((event as { toolName?: string }).toolName ?? "unknown");
        const ok = (event as { success?: boolean }).success !== false;
        const durationRaw = (event as unknown as { durationMs?: number }).durationMs;
        const durationMs = typeof durationRaw === "number" ? durationRaw : 0;
        logger.log("debug", {
          type: "tool_end",
          runId,
          stepNumber: stepCount,
          toolName,
          ok,
          durationMs,
        });
      },
      onStepEnd: (event) => {
        const stepNumber =
          typeof (event as { stepNumber?: number }).stepNumber === "number"
            ? (event as { stepNumber: number }).stepNumber
            : stepCount;
        const finishReason = (event as { finishReason?: string }).finishReason;
        const toolCalls = (event as { toolCalls?: unknown[] }).toolCalls;
        logger.log("debug", {
          type: "step_end",
          runId,
          stepNumber,
          finishReason,
          toolCallCount: toolCalls?.length ?? 0,
          durationMs: 0,
        });
      },
    });

    stepCount = Math.max(stepCount, result.steps?.length ?? 0);
    toolCallCount = Math.max(toolCallCount, countToolCalls(result.steps ?? []));
    const usage = toUsage(result.usage);
    const durationMs = Date.now() - started;

    if (toolCallCount > limits.maxToolCalls) {
      logger.log("warn", {
        type: "run_end",
        runId,
        status: "limit_exceeded",
        stepCount,
        toolCallCount,
        finishReason: result.finishReason,
        usage: usage as Record<string, number> | undefined,
        errorCode: "limit_exceeded",
        durationMs,
      });
      return {
        ok: false,
        error: {
          code: "limit_exceeded",
          message: `Tool call count ${toolCallCount} exceeded maxToolCalls (${limits.maxToolCalls}).`,
        },
        stepCount,
        toolCallCount,
        finishReason: result.finishReason,
        usage,
        promptVersion: input.promptVersion,
        promptHash: input.promptHash,
        model: modelId,
        durationMs,
      };
    }

    const parsed = input.outputSchema.safeParse(result.output);
    if (!parsed.success) {
      logger.log("error", {
        type: "run_end",
        runId,
        status: "failed",
        stepCount,
        toolCallCount,
        finishReason: result.finishReason,
        usage: usage as Record<string, number> | undefined,
        errorCode: "invalid_output",
        durationMs,
      });
      return {
        ok: false,
        error: {
          code: "invalid_output",
          message: "Agent output failed schema validation.",
          details: { issues: parsed.error.issues.slice(0, 8) },
        },
        stepCount,
        toolCallCount,
        finishReason: result.finishReason,
        usage,
        promptVersion: input.promptVersion,
        promptHash: input.promptHash,
        model: modelId,
        durationMs,
      };
    }

    if (
      stepCount >= limits.maxSteps &&
      result.finishReason === "tool-calls" &&
      result.output == null
    ) {
      logger.log("warn", {
        type: "run_end",
        runId,
        status: "limit_exceeded",
        stepCount,
        toolCallCount,
        finishReason: result.finishReason,
        usage: usage as Record<string, number> | undefined,
        errorCode: "limit_exceeded",
        durationMs,
      });
      return {
        ok: false,
        error: {
          code: "limit_exceeded",
          message: `Reached maxSteps (${limits.maxSteps}) without structured output.`,
        },
        stepCount,
        toolCallCount,
        finishReason: result.finishReason,
        usage,
        promptVersion: input.promptVersion,
        promptHash: input.promptHash,
        model: modelId,
        durationMs,
      };
    }

    logger.log("info", {
      type: "run_end",
      runId,
      status: "completed",
      stepCount,
      toolCallCount,
      finishReason: result.finishReason,
      usage: usage as Record<string, number> | undefined,
      durationMs,
    });

    return {
      ok: true,
      output: parsed.data,
      stepCount,
      toolCallCount,
      finishReason: result.finishReason,
      usage,
      promptVersion: input.promptVersion,
      promptHash: input.promptHash,
      model: modelId,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : "Agent run failed.";
    const code =
      error instanceof AgentError ? error.code : /timeout/i.test(message) ? "timeout" : "internal";

    logger.log("error", {
      type: "run_end",
      runId,
      status: "failed",
      stepCount,
      toolCallCount,
      errorCode: code,
      durationMs,
    });

    return {
      ok: false,
      error: {
        code,
        message,
        details: error instanceof AgentError ? error.details : undefined,
      },
      stepCount,
      toolCallCount,
      promptVersion: input.promptVersion,
      promptHash: input.promptHash,
      model: modelId,
      durationMs,
    };
  }
}
