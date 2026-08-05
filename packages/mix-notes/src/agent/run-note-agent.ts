import {
  createAgentLogger,
  runBoundedAgent,
  type AgentLogger,
  type BoundedAgentResult,
} from "@selecta/agentics";

import { providerFromModel } from "../extract-note";
import { CandidateRegistry, withCandidateRegistry } from "./candidate-registry";
import { buildNoteAgentPrompt, buildNoteAgentUserPrompt, NOTE_AGENT_NAME } from "./prompt";
import { NoteProcessingPlanSchema, type NoteProcessingPlan } from "./schema";
import type { NoteAgentServices } from "./services";
import { createNoteAgentTools } from "./tools";

export const DEFAULT_NOTE_AGENT_MODEL = "openai/gpt-4.1-mini" as const;

export type RunNoteAgentInput = {
  rawText: string;
  graphSchemaText: string;
  services: NoteAgentServices;
  model?: string;
  maxSteps?: number;
  logger?: AgentLogger;
  runId?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type RunNoteAgentSuccess = {
  ok: true;
  plan: NoteProcessingPlan;
  candidates: CandidateRegistry;
  model: string;
  provider: string;
  promptVersion: string;
  promptHash: string;
  stepCount: number;
  toolCallCount: number;
  finishReason?: string;
  usage?: BoundedAgentResult<NoteProcessingPlan> extends { usage?: infer U } ? U : never;
  durationMs: number;
};

export type RunNoteAgentFailure = {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
  candidates: CandidateRegistry;
  model: string;
  provider: string;
  promptVersion: string;
  promptHash: string;
  stepCount: number;
  toolCallCount: number;
  durationMs: number;
};

export type RunNoteAgentResult = RunNoteAgentSuccess | RunNoteAgentFailure;

function needsStructuredOutputRetry(result: BoundedAgentResult<NoteProcessingPlan>): boolean {
  if (result.ok) return false;
  if (result.error.code !== "invalid_output") return false;
  return /No structured output|No output generated/i.test(result.error.message);
}

/**
 * Bounded note-processing agent: read-only library + Spotify tools, structured plan output.
 *
 * If a tool-loop ends without a `stop` structured-output step (common provider quirk),
 * retries once with tools disabled so the model must emit the JSON plan.
 */
export async function runNoteAgent(input: RunNoteAgentInput): Promise<RunNoteAgentResult> {
  const rawText = input.rawText.trim();
  if (!rawText) {
    throw new Error("rawText is required for note agent.");
  }

  const model =
    input.model?.trim() || process.env.NOTE_AGENT_MODEL?.trim() || DEFAULT_NOTE_AGENT_MODEL;
  const maxStepsEnv = Number(process.env.NOTE_AGENT_MAX_STEPS ?? "");
  const maxSteps = Math.min(
    4,
    Math.max(1, input.maxSteps ?? (Number.isFinite(maxStepsEnv) ? maxStepsEnv : 4)),
  );

  const prompt = buildNoteAgentPrompt({ graphSchemaText: input.graphSchemaText });
  const registry = new CandidateRegistry();
  const services = withCandidateRegistry(input.services, registry);
  const tools = createNoteAgentTools(services);
  const logger = input.logger ?? createAgentLogger();
  const userPrompt = buildNoteAgentUserPrompt(rawText);
  const provider = providerFromModel(model);

  const common = {
    agentName: NOTE_AGENT_NAME,
    model,
    promptVersion: prompt.promptVersion,
    promptHash: prompt.promptHash,
    instructions: prompt.system,
    userPrompt,
    outputSchema: NoteProcessingPlanSchema,
    limits: { maxSteps },
    logger,
    runId: input.runId,
    meta: input.meta,
  } as const;

  let result = await runBoundedAgent({
    ...common,
    tools,
  });

  if (!result.ok && needsStructuredOutputRetry(result)) {
    const firstError = result.error;
    logger.log("warn", {
      type: "retry",
      runId: input.runId ?? "note-agent",
      reason: "Tool loop finished without structured output; retrying with tools disabled.",
    });

    const retry = await runBoundedAgent({
      ...common,
      tools: {},
      limits: { maxSteps: Math.min(2, maxSteps) },
      runId: input.runId ? `${input.runId}:retry` : undefined,
    });

    const combinedSteps = result.stepCount + retry.stepCount;
    const combinedTools = result.toolCallCount + retry.toolCallCount;
    const combinedDuration = result.durationMs + retry.durationMs;

    if (retry.ok) {
      result = {
        ...retry,
        stepCount: combinedSteps,
        toolCallCount: combinedTools,
        durationMs: combinedDuration,
      };
    } else {
      result = {
        ...retry,
        stepCount: combinedSteps,
        toolCallCount: combinedTools,
        durationMs: combinedDuration,
        error: {
          ...retry.error,
          message: `${firstError.message} | Retry: ${retry.error.message}`,
        },
      };
    }
  }

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      candidates: registry,
      model,
      provider,
      promptVersion: result.promptVersion,
      promptHash: result.promptHash,
      stepCount: result.stepCount,
      toolCallCount: result.toolCallCount,
      durationMs: result.durationMs,
    };
  }

  return {
    ok: true,
    plan: result.output,
    candidates: registry,
    model,
    provider,
    promptVersion: result.promptVersion,
    promptHash: result.promptHash,
    stepCount: result.stepCount,
    toolCallCount: result.toolCallCount,
    finishReason: result.finishReason,
    usage: result.usage,
    durationMs: result.durationMs,
  };
}
