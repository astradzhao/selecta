/**
 * Shared bounded agent harness (limits, logging, prompt composition, ToolLoopAgent).
 * `runBoundedAgent` is intentionally unused today — reserved for future multi-step agents.
 */

export { AgentError, isAgentError, type AgentErrorCode } from "./errors";
export { DEFAULT_AGENT_LIMITS, clampAgentLimits, type AgentLimits } from "./limits";
export {
  createAgentLogger,
  createConsoleAgentLogger,
  createNoopAgentLogger,
  isDevModeLoggingEnabled,
  type AgentLogEvent,
  type AgentLogLevel,
  type AgentLogger,
} from "./logging";
export {
  composeAgentSystemPrompt,
  stableStringify,
  type ComposedPrompt,
  type PromptSection,
} from "./prompt";
export { providerFromModel } from "./provider";
export { runBoundedAgent } from "./harness";
export type {
  AgentRunContext,
  AgentUsage,
  BoundedAgentFailure,
  BoundedAgentResult,
  BoundedAgentSuccess,
  RunBoundedAgentInput,
} from "./types";
