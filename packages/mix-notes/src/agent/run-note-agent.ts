import { runBoundedAgent, type AgentLogger, type BoundedAgentResult } from "@selecta/agentics";

import { CandidateRegistry, withCandidateRegistry } from "./candidate-registry";
import { buildNoteAgentPrompt, buildNoteAgentUserPrompt, NOTE_AGENT_NAME } from "./prompt";
import { NoteProcessingPlanSchema, type NoteProcessingPlan } from "./schema";
import type { NoteAgentServices } from "./services";
import { createNoteAgentTools } from "./tools";
import { providerFromModel } from "../extract-note";

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

/**
 * Bounded note-processing agent: read-only library + Spotify tools, structured plan output.
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

  const result = await runBoundedAgent({
    agentName: NOTE_AGENT_NAME,
    model,
    promptVersion: prompt.promptVersion,
    promptHash: prompt.promptHash,
    instructions: prompt.system,
    userPrompt: buildNoteAgentUserPrompt(rawText),
    tools,
    outputSchema: NoteProcessingPlanSchema,
    limits: { maxSteps },
    logger: input.logger,
    runId: input.runId,
    meta: input.meta,
  });

  const provider = providerFromModel(model);

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
