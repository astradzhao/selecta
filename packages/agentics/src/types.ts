import type { ToolSet } from "ai";
import type { z } from "zod";

import type { AgentLimits } from "./limits";
import type { AgentLogger } from "./logging";

export type AgentRunContext = {
  runId: string;
  agentName: string;
  /** Opaque correlation fields (note id, version, etc.). */
  meta?: Record<string, string | number | boolean | null>;
};

export type AgentUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type BoundedAgentSuccess<TOutput> = {
  ok: true;
  output: TOutput;
  stepCount: number;
  toolCallCount: number;
  finishReason?: string;
  usage?: AgentUsage;
  promptVersion: string;
  promptHash: string;
  model: string;
  durationMs: number;
};

export type BoundedAgentFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  stepCount: number;
  toolCallCount: number;
  finishReason?: string;
  usage?: AgentUsage;
  promptVersion: string;
  promptHash: string;
  model: string;
  durationMs: number;
};

export type BoundedAgentResult<TOutput> = BoundedAgentSuccess<TOutput> | BoundedAgentFailure;

export type RunBoundedAgentInput<TOutput, TOOLS extends ToolSet = ToolSet> = {
  agentName: string;
  /** AI Gateway model id (`provider/model`) or a LanguageModel instance (tests). */
  model: import("ai").LanguageModel;
  promptVersion: string;
  /** Pre-composed system instructions (from composeAgentSystemPrompt). */
  instructions: string;
  promptHash: string;
  userPrompt: string;
  tools?: TOOLS;
  outputSchema: z.ZodType<TOutput>;
  limits?: Partial<AgentLimits>;
  logger?: AgentLogger;
  runId?: string;
  meta?: AgentRunContext["meta"];
  /**
   * Optional prepareStep override. When omitted, tools are available for the
   * first two steps and disabled afterward to force structured output.
   */
  prepareStep?: import("ai").PrepareStepFunction<TOOLS, Record<string, never>>;
};
