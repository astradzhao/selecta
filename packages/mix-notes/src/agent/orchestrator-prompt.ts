import { composeAgentSystemPrompt, type ComposedPrompt } from "@selecta/agentics";

import { SingleTransitionDraftSchema } from "./single-transition-schema";

export const ORCHESTRATOR_AGENT_NAME = "transition-orchestrator" as const;
export const ORCHESTRATOR_PROMPT_VERSION = "v1" as const;
export const SINGLE_TRANSITION_PROMPT_VERSION = "v1" as const;
export const DEFAULT_ORCHESTRATOR_MODEL = "openai/gpt-5.4-mini" as const;
export const DEFAULT_SINGLE_TRANSITION_MODEL = "openai/gpt-5.4-mini" as const;

export type OrchestratorPrompt = {
  system: string;
  promptVersion: string;
};

/**
 * Bounded orchestrator prompt (no Node crypto — safe for workflow sandbox).
 * Discover transition spans and dispatch parse_single_transition only.
 */
export function buildOrchestratorPrompt(maxTransitions: number): OrchestratorPrompt {
  const system = [
    "## Identity",
    "",
    "You segment DJ transition notes into individual transition spans. You do not extract full transition details yourself.",
    "",
    "## Objective",
    "",
    "1. Read the full submission.",
    "2. Identify each distinct A→B (or multi-hop) transition described in the text.",
    "3. For every transition, call parse_single_transition once with the exact source span.",
    "4. You may call parse_single_transition multiple times in one step (parallel).",
    "5. When finished, stop. Do not redispatch a span that already returned ok.",
    `6. Hard limit: at most ${maxTransitions} transitions. If more exist, stop after ${maxTransitions} and note the overflow in your final message.`,
    "",
    "## Rules",
    "",
    "- sourceStart/sourceEnd are 0-based character offsets into the submission (inclusive start, exclusive end).",
    "- sourceText must equal submission.slice(sourceStart, sourceEnd).",
    "- Prefer contiguous spans that include both song mentions and transition cues.",
    "- Skip non-transition prose (crate organization, solo song notes without a mix).",
    "- Never invent songs or transitions not implied by the text.",
    "- Do not call any tool other than parse_single_transition.",
    "- Do not ask the model to retry failed children — the runtime retries them.",
    `- Always pass submissionId and extractionVersion exactly as provided in the user message.`,
  ].join("\n");

  return {
    system,
    promptVersion: ORCHESTRATOR_PROMPT_VERSION,
  };
}

export function buildOrchestratorUserPrompt(
  rawSubmission: string,
  meta: { submissionId: string; extractionVersion: number },
): string {
  return [
    `submissionId: ${meta.submissionId}`,
    `extractionVersion: ${meta.extractionVersion}`,
    "",
    "Segment this DJ transition submission and dispatch parse_single_transition for each transition:",
    "",
    rawSubmission.trim(),
  ].join("\n");
}

/** Child parser prompt — runs inside a step (Node crypto OK). */
export function buildSingleTransitionPrompt(): ComposedPrompt {
  return composeAgentSystemPrompt({
    promptVersion: SINGLE_TRANSITION_PROMPT_VERSION,
    outputSchema: SingleTransitionDraftSchema,
    outputSchemaTitle: "Single transition draft schema",
    sections: [
      {
        id: "identity",
        title: "Identity",
        body: "You extract exactly one DJ transition draft from a source span. You do not search catalogs or the library.",
      },
      {
        id: "objective",
        title: "Objective",
        body: [
          "1. Extract song mentions and exactly one transition from the span.",
          "2. Return one JSON draft.",
          "3. Downstream code matches titles/artists to the library and Spotify.",
        ].join("\n"),
      },
      {
        id: "rules",
        title: "Rules",
        body: [
          "- Extract only what this span describes — ignore surrounding context not present in the span.",
          "- Never invent track titles, artists, bars, techniques, or intents not implied by the span.",
          "- Put title/artist guesses in titleHint/artistHint when possible.",
          "- Include every schema key; use null for unknown optional fields.",
          "- Do not invent track ids or catalog ids.",
          "- Prefer noteType=transition when a mix/transition is present.",
        ].join("\n"),
      },
    ],
  });
}

export function buildSingleTransitionUserPrompt(sourceText: string): string {
  return [
    "Extract exactly one transition draft from this source span:",
    "",
    sourceText.trim(),
  ].join("\n");
}
