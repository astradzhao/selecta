import { NOTE_TYPES, TRANSITION_QUALITIES, type ExtractionProposal } from "./extraction-schema";

/**
 * Versioned free-form note extraction prompt (DJ-32).
 *
 * Callers (DJ-34+) should persist `promptVersion` and `model` on the Postgres
 * note alongside the structured extraction preview.
 */

/** Bump when system prompt text or few-shot examples change materially. */
export const EXTRACTION_PROMPT_VERSION = "v1" as const;

/**
 * Default AI Gateway model id for extraction.
 * Override per-request; always store the actual model used on the note.
 */
export const DEFAULT_EXTRACTION_MODEL = "openai/gpt-4.1-mini" as const;

export type ExtractionPromptMeta = {
  promptVersion: typeof EXTRACTION_PROMPT_VERSION;
  model: string;
};

/** Metadata to persist on a note after an extraction call. */
export function getExtractionPromptMeta(
  model: string = DEFAULT_EXTRACTION_MODEL,
): ExtractionPromptMeta {
  return {
    promptVersion: EXTRACTION_PROMPT_VERSION,
    model,
  };
}

export type ExtractionPromptExample = {
  id: string;
  /** Human label for tests / docs. */
  description: string;
  note: string;
  /** Canonical structured proposal for this note (few-shot + regression). */
  expected: ExtractionProposal;
};

/**
 * Few-shot cases from DJ-32: transition, song-only, no song, partial fields.
 * Expected objects must remain valid against ExtractionProposalSchema.
 */
export const EXTRACTION_PROMPT_EXAMPLES = [
  {
    id: "transition-bars",
    description: "Terse A→B transition with bars",
    note: "levels - avicii -> love someone - prospa bar 32 -> bar 40",
    expected: {
      noteType: "transition",
      songMentions: [
        {
          mention: "levels - avicii",
          titleHint: "Levels",
          artistHint: "Avicii",
          resolvedId: null,
        },
        {
          mention: "love someone - prospa",
          titleHint: "Love Someone",
          artistHint: "Prospa",
          resolvedId: null,
        },
      ],
      transitionProposals: [
        {
          fromMention: "levels - avicii",
          toMention: "love someone - prospa",
          fromBar: 32,
          toBar: 40,
        },
      ],
      confidence: 0.85,
      ambiguities: [],
    },
  },
  {
    id: "song-note-only",
    description: "One song mention, no transition",
    note: "need to dig up that prospa love someone remix for peak time",
    expected: {
      noteType: "song_note",
      songMentions: [
        {
          mention: "prospa love someone remix",
          titleHint: "Love Someone",
          artistHint: "Prospa",
          resolvedId: null,
        },
      ],
      transitionProposals: [],
      confidence: 0.7,
      ambiguities: ["Which Love Someone remix / version?"],
    },
  },
  {
    id: "no-recognizable-song",
    description: "Free-form note with no song to extract",
    note: "booth monitors were harsh tonight — cut highs next time",
    expected: {
      noteType: "unknown",
      songMentions: [],
      transitionProposals: [],
      confidence: 0.95,
      ambiguities: [],
    },
  },
  {
    id: "partial-technique-intent",
    description: "Partial bars / technique / intent without full transition pair",
    note: "hpf out around bar 16 to cool down",
    expected: {
      noteType: "transition",
      songMentions: [],
      transitionProposals: [
        {
          fromBar: 16,
          technique: "high_pass_filter",
          intent: "cool_down",
        },
      ],
      confidence: 0.55,
      ambiguities: ["Which tracks does this transition connect?"],
    },
  },
] as const satisfies readonly ExtractionPromptExample[];

function formatExampleBlock(example: ExtractionPromptExample): string {
  return [
    `### Example: ${example.id}`,
    `Note: ${JSON.stringify(example.note)}`,
    `Output:`,
    "```json",
    JSON.stringify(example.expected, null, 2),
    "```",
  ].join("\n");
}

/** System instructions for structured extraction (versioned). */
export function buildExtractionSystemPrompt(): string {
  const noteTypes = NOTE_TYPES.join(" | ");
  const qualities = TRANSITION_QUALITIES.join(" | ");
  const examples = EXTRACTION_PROMPT_EXAMPLES.map(formatExampleBlock).join("\n\n");

  return `You extract structured DJ mix proposals from free-form notes.

Prompt version: ${EXTRACTION_PROMPT_VERSION}

## Goals
- Parse terse, arbitrary DJ notes into proposals for optional graph updates.
- Never assume every note is a transition.
- A note may mention zero songs and propose zero transitions — that is valid.
- Leave fields omitted (or null for unresolved ids / unknown bars) when the note does not support them.
- Do not invent track titles, artists, bars, techniques, or intents that are not implied by the note.
- Prefer seeded technique/intent spellings when clear (e.g. high_pass_filter, cool_down); otherwise use a short free-form string from the note.
- Do not resolve songs to catalog ids; set resolvedId to null.

## Output shape (JSON object)
- noteType: ${noteTypes}
  - transition: the note primarily describes a mix from one track to another (even if partial)
  - song_note: song(s) mentioned with no transition
  - unknown: no recognizable song or mix proposal
  - mixed: more than one of the above clearly present
- songMentions: array (may be empty). Each item: mention (required), optional titleHint, artistHint, resolvedId (always null for now)
- transitionProposals: array (may be empty). Each item may include optional fromMention, toMention, fromBar, toBar, barsOverlap, technique, intent, quality (${qualities}), notes
- confidence: number from 0 to 1
- ambiguities: array of short human-readable strings for unclear mentions or missing fields

## Few-shot examples

${examples}

Return only a single JSON object matching the output shape.`;
}

/** User message wrapping the raw note text to extract. */
export function buildExtractionUserPrompt(rawNote: string): string {
  return ["Extract structured proposals from this DJ note:", "", rawNote.trim()].join("\n");
}

export type ExtractionPromptMessage = {
  role: "system" | "user";
  content: string;
};

/**
 * Messages for AI SDK `generateText` (+ `Output.object({ schema })`).
 * Persist `getExtractionPromptMeta(model)` on the note after the call.
 */
export function buildExtractionMessages(rawNote: string): ExtractionPromptMessage[] {
  return [
    { role: "system", content: buildExtractionSystemPrompt() },
    { role: "user", content: buildExtractionUserPrompt(rawNote) },
  ];
}
