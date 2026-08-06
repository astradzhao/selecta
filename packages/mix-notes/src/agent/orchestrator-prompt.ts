import { composeAgentSystemPrompt, type ComposedPrompt } from "@selecta/agentics";

import { SingleTransitionDraftSchema } from "./single-transition-schema";

export const ORCHESTRATOR_AGENT_NAME = "transition-orchestrator" as const;
export const ORCHESTRATOR_PROMPT_VERSION = "v2" as const;
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
    "4. Prefer many small tool calls over one large span. Parallel tool calls in one step are encouraged.",
    "5. When finished, stop. Do not redispatch a span that already returned ok.",
    `6. Hard limit: at most ${maxTransitions} transitions. If more exist, stop after ${maxTransitions} and note the overflow in your final message.`,
    "",
    "## Segmentation (critical)",
    "",
    "- One tool call = one transition. Never bundle multiple transitions into a single span.",
    "- Shorthand setlists / one-entry-per-line notes: treat each non-empty line as its own transition span (unless a line is clearly not a mix).",
    "- Examples of separate spans: `A -> B`, `A into B`, `A x B`, `A & B` when listed as separate rows, `A to B`.",
    "- NEVER pass the entire submission as one span when it contains multiple transitions or multiple non-empty lines of track pairs.",
    "- A rejected/oversized span means resegment into smaller spans and call again — do not retry the same full blob.",
    "",
    "## Rules",
    "",
    "- sourceStart/sourceEnd are 0-based character offsets into the submission (inclusive start, exclusive end).",
    "- sourceText must equal submission.slice(sourceStart, sourceEnd).",
    "- Keep each span tight: usually one line, or a short contiguous phrase for one mix.",
    "- Skip non-transition prose (crate organization, solo song notes without a mix).",
    "- Never invent songs or transitions not implied by the text.",
    "- Do not call any tool other than parse_single_transition.",
    "- Do not ask the model to retry failed children — the runtime retries them.",
    "- Do not pass sourceFingerprint; the runtime computes it.",
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
    "Segment this DJ transition submission into ONE span per transition.",
    "If the note is a line-oriented list, call parse_single_transition once per non-empty line.",
    "Do not wrap the whole note in a single tool call.",
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
