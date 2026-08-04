/** Hard limits for bounded agent runs. */

export type AgentLimits = {
  /** Hard ceiling on LLM steps (inclusive). */
  maxSteps: number;
  /** Soft guidance for prompts / docs. */
  targetMaxSteps: number;
  maxToolCalls: number;
  maxOutputTokens: number;
  maxInputCharacters: number;
  maxToolResultBytes: number;
  totalMs: number;
  stepMs: number;
  toolMs: number;
};

export const DEFAULT_AGENT_LIMITS: AgentLimits = {
  maxSteps: 4,
  targetMaxSteps: 3,
  maxToolCalls: 6,
  maxOutputTokens: 1_800,
  maxInputCharacters: 4_000,
  maxToolResultBytes: 30_000,
  totalMs: 25_000,
  stepMs: 10_000,
  toolMs: 6_000,
};

export function clampAgentLimits(partial?: Partial<AgentLimits>): AgentLimits {
  const merged = { ...DEFAULT_AGENT_LIMITS, ...partial };
  if (merged.maxSteps > 4) {
    throw new Error(`Agent maxSteps cannot exceed 4 (got ${merged.maxSteps}).`);
  }
  if (merged.maxSteps < 1) {
    throw new Error(`Agent maxSteps must be at least 1 (got ${merged.maxSteps}).`);
  }
  return merged;
}
