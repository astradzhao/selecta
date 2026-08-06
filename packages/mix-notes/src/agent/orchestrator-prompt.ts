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
    "4. Prefer many small tool calls over one large span. Parallel tool calls in one step are encouraged.",
    "5. When finished, stop. Do not redispatch a span that already returned ok.",
    `6. Hard limit: at most ${maxTransitions} transitions. If more exist, stop after ${maxTransitions} and note the overflow in your final message.`,
    "",
    "## Segmentation (critical)",
    "",
    "- One tool call = one transition (or one unordered pair). Never bundle multiple mixes into a single span.",
    "- Shorthand setlists / one-entry-per-line notes: treat each non-empty line as its own span (unless a line is clearly not a mix).",
    "- Directed examples: `A -> B`, `A into B`, `A to B`.",
    "- Unordered pair examples (child sets bidirectional=true): `A, B`, `A & B`, `A x B` on one line.",
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
          "1. Split the span into exactly TWO track endpoints.",
          "2. For each endpoint, emit one Spotify search query string in `mention` (keep the words together — do NOT split title vs artist).",
          "3. Emit exactly one transition m1 → m2.",
          "4. Downstream code searches Spotify with those two queries and takes the top hit.",
        ].join("\n"),
      },
      {
        id: "query-grammar",
        title: "Query grammar (critical)",
        body: [
          "Always emit exactly 2 mentions (m1, m2).",
          "Each `mention` value is a ready-made search query for that track — typically the raw tokens from that side of the mix.",
          "Set titleHint and artistHint to null (Spotify ranking handles identity).",
          "",
          "Separators that split LEFT query from RIGHT query:",
          "- directed: `->`, `→`, `to`, `into` → bidirectional=false",
          "- unordered pair: `,`, `&`, or `x` between two tracks → bidirectional=true",
          "",
          "Examples:",
          '- `mirror sabai to getting late slander` → m1.mention="mirror sabai"; m2.mention="getting late slander"; bidirectional=false',
          '- `jaw drop curbi & beam iso` → m1.mention="jaw drop curbi"; m2.mention="beam iso"; bidirectional=true',
          '- `limits imanbek -> euphoria rush chyl` → m1.mention="limits imanbek"; m2.mention="euphoria rush chyl"; bidirectional=false',
          '- `Thrilla nightmre -> backspin bass` → m1.mention="Thrilla nightmre"; m2.mention="backspin bass"; bidirectional=false',
          '- `leave before you love me marshmello, last goodbye sunkis` → m1.mention="leave before you love me marshmello"; m2.mention="last goodbye sunkis"; bidirectional=true',
          "",
          "Hard anti-patterns:",
          "- Do NOT invent titleHint/artistHint splits.",
          "- Do NOT emit 3–4 mentions.",
          "- Do NOT drop tokens from either side.",
          "- `x` inside a phrase like `roses x children tommymuzic` is usually ONE query, not a separator — unless there is also a clear `->`/`to`/`&` between two tracks.",
        ].join("\n"),
      },
      {
        id: "rules",
        title: "Rules",
        body: [
          "- Extract only what this span describes.",
          "- Never invent bars, techniques, or intents not implied by the span.",
          "- mentionId must be m1 and m2; transition.fromMentionId=m1, toMentionId=m2.",
          "- Include every schema key; use null for unknown optional fields.",
          "- Prefer noteType=transition when a mix/transition is present.",
          "- Missing bars/technique/intent/quality is normal — leave them null. Do NOT lower confidence for missing metadata.",
          "",
          "confidence (enum: none | low | moderate | strong | high | full):",
          "- high/full: clear two-track mix under the grammar above.",
          "- strong: clear enough structure to auto-commit.",
          "- moderate/low/none: cannot form two credible search queries.",
          "- Do NOT use moderate/low just because the line is terse or lacks bars.",
          "",
          "ambiguities: leave empty [] for normal shorthand mixes.",
        ].join("\n"),
      },
    ],
  });
}

export function buildSingleTransitionUserPrompt(sourceText: string): string {
  return [
    "Extract exactly one transition draft from this source span.",
    "Emit exactly two mentions (m1, m2). Each mention value is a Spotify search query for that endpoint — do not split title/artist; set titleHint and artistHint to null.",
    "",
    sourceText.trim(),
  ].join("\n");
}
