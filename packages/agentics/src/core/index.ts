/** Shared bounded agent harness (limits, logging, prompt composition, ToolLoopAgent). */

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
export { runBoundedAgent } from "./harness";
export type {
  AgentRunContext,
  AgentUsage,
  BoundedAgentFailure,
  BoundedAgentResult,
  BoundedAgentSuccess,
  RunBoundedAgentInput,
} from "./types";
