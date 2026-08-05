import { createAgentLogger, type AgentLogger, type AgentUsage } from "@selecta/agentics";
import { generateText, NoOutputGeneratedError, Output } from "ai";

import { providerFromModel } from "../extract-note";
import { CandidateRegistry } from "./candidate-registry";
import { buildNoteAgentPrompt, buildNoteAgentUserPrompt, NOTE_AGENT_NAME } from "./prompt";
import { resolveNoteMentions } from "./resolve-mentions";
import {
  draftToUnresolvedPlan,
  NoteExtractionDraftSchema,
  type NoteProcessingPlan,
} from "./schema";
import type { NoteAgentServices } from "./services";

export const DEFAULT_NOTE_AGENT_MODEL = "anthropic/claude-haiku-4.5" as const;

export type RunNoteAgentInput = {
  rawText: string;
  services: NoteAgentServices;
  model?: string;
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
  usage?: AgentUsage;
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
 * Cheap note pipeline: one-shot structured extraction (no tools), then deterministic
 * library → Spotify resolution. `@selecta/agentics` remains available for future agents.
 */
export async function runNoteAgent(input: RunNoteAgentInput): Promise<RunNoteAgentResult> {
  const rawText = input.rawText.trim();
  if (!rawText) {
    throw new Error("rawText is required for note agent.");
  }

  const model =
    input.model?.trim() || process.env.NOTE_AGENT_MODEL?.trim() || DEFAULT_NOTE_AGENT_MODEL;
  const logger = input.logger ?? createAgentLogger();
  const prompt = buildNoteAgentPrompt();
  const provider = providerFromModel(model);
  const started = Date.now();
  const runId = input.runId ?? "note-extract";
  const emptyCandidates = new CandidateRegistry();

  logger.log("info", {
    type: "run_start",
    runId,
    agentName: NOTE_AGENT_NAME,
    model,
    promptVersion: prompt.promptVersion,
    maxSteps: 1,
  });

  try {
    const result = await generateText({
      model,
      system: prompt.system,
      prompt: buildNoteAgentUserPrompt(rawText),
      output: Output.object({
        schema: NoteExtractionDraftSchema,
      }),
      maxOutputTokens: 1_200,
    });

    let draftUnknown: unknown;
    try {
      draftUnknown = result.output;
    } catch (error) {
      if (NoOutputGeneratedError.isInstance(error)) {
        const message = "No structured extraction draft generated.";
        logger.log("error", {
          type: "run_end",
          runId,
          status: "failed",
          stepCount: 1,
          toolCallCount: 0,
          finishReason: result.finishReason,
          errorCode: "invalid_output",
          errorMessage: message,
          durationMs: Date.now() - started,
        });
        return {
          ok: false,
          error: { code: "invalid_output", message },
          candidates: emptyCandidates,
          model,
          provider,
          promptVersion: prompt.promptVersion,
          promptHash: prompt.promptHash,
          stepCount: 1,
          toolCallCount: 0,
          durationMs: Date.now() - started,
        };
      }
      throw error;
    }

    const parsed = NoteExtractionDraftSchema.safeParse(draftUnknown);
    if (!parsed.success) {
      logger.log("error", {
        type: "run_end",
        runId,
        status: "failed",
        stepCount: 1,
        toolCallCount: 0,
        finishReason: result.finishReason,
        errorCode: "invalid_output",
        errorMessage: "Extraction draft failed schema validation.",
        durationMs: Date.now() - started,
      });
      return {
        ok: false,
        error: {
          code: "invalid_output",
          message: "Extraction draft failed schema validation.",
          details: { issues: parsed.error.issues.slice(0, 8) },
        },
        candidates: emptyCandidates,
        model,
        provider,
        promptVersion: prompt.promptVersion,
        promptHash: prompt.promptHash,
        stepCount: 1,
        toolCallCount: 0,
        durationMs: Date.now() - started,
      };
    }

    const unresolved = draftToUnresolvedPlan(parsed.data);
    const resolved = await resolveNoteMentions({
      plan: unresolved,
      services: input.services,
    });

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
      plan: resolved.plan,
      candidates: resolved.candidates,
      model,
      provider,
      promptVersion: prompt.promptVersion,
      promptHash: prompt.promptHash,
      stepCount: 1,
      toolCallCount: 0,
      finishReason: result.finishReason,
      usage: toUsage(result.usage),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Note extraction failed.";
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
      error: { code: "internal", message },
      candidates: emptyCandidates,
      model,
      provider,
      promptVersion: prompt.promptVersion,
      promptHash: prompt.promptHash,
      stepCount: 0,
      toolCallCount: 0,
      durationMs: Date.now() - started,
    };
  }
}
