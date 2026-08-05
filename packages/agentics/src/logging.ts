/** Structured logging for agent runs (no raw secrets / note text by default). */

export type AgentLogLevel = "debug" | "info" | "warn" | "error";

export type AgentLogEvent =
  | {
      type: "run_start";
      runId: string;
      agentName: string;
      model: string;
      promptVersion: string;
      maxSteps: number;
    }
  | {
      type: "run_end";
      runId: string;
      status: "completed" | "failed" | "limit_exceeded";
      stepCount: number;
      toolCallCount: number;
      finishReason?: string;
      usage?: Record<string, number>;
      errorCode?: string;
      errorMessage?: string;
      durationMs: number;
    }
  | {
      type: "step_start";
      runId: string;
      stepNumber: number;
    }
  | {
      type: "step_end";
      runId: string;
      stepNumber: number;
      finishReason?: string;
      toolCallCount: number;
      durationMs: number;
    }
  | {
      type: "tool_start";
      runId: string;
      stepNumber: number;
      toolName: string;
    }
  | {
      type: "tool_end";
      runId: string;
      stepNumber: number;
      toolName: string;
      ok: boolean;
      resultCount?: number;
      durationMs: number;
      errorCode?: string;
    }
  | {
      type: "policy";
      runId: string;
      decision: string;
      reasons: string[];
    }
  | {
      type: "coordinator";
      runId: string;
      noteId?: string;
      extractionVersion?: number;
      phase: string;
      detail?: string;
    }
  | {
      type: "retry";
      runId: string;
      reason: string;
    };

export type AgentLogger = {
  log(level: AgentLogLevel, event: AgentLogEvent): void;
};

/** True when local verbose agent logging is enabled. */
export function isDevModeLoggingEnabled(): boolean {
  const value = process.env.DEV_MODE?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** No-op logger used when DEV_MODE is off. */
export function createNoopAgentLogger(): AgentLogger {
  return { log() {} };
}

/** Default logger — structured JSON to stdout; never dumps raw payloads. */
export function createConsoleAgentLogger(): AgentLogger {
  return {
    log(level, event) {
      const line = JSON.stringify({ level, ts: new Date().toISOString(), ...event });
      if (level === "error") {
        console.error(line);
      } else if (level === "warn") {
        console.warn(line);
      } else {
        console.info(line);
      }
    },
  };
}

/**
 * Logger for agent/coordinator runs.
 * Quiet by default; set `DEV_MODE=true` to print structured events.
 */
export function createAgentLogger(options?: { force?: boolean }): AgentLogger {
  if (options?.force || isDevModeLoggingEnabled()) {
    return createConsoleAgentLogger();
  }
  return createNoopAgentLogger();
}
