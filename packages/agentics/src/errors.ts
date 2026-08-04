/** Typed errors for bounded agent runs. */

export type AgentErrorCode =
  | "limit_exceeded"
  | "timeout"
  | "invalid_output"
  | "validation_failed"
  | "not_configured"
  | "internal";

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: AgentErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AgentError";
    this.code = code;
    this.details = details;
  }
}

export function isAgentError(error: unknown): error is AgentError {
  return error instanceof AgentError;
}
