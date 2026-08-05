import { composeAgentSystemPrompt, type ComposedPrompt } from "@selecta/agentics";

import { EXTRACTION_PROMPT_EXAMPLES } from "../extraction-prompt";
import { NoteExtractionDraftSchema } from "./schema";

export const NOTE_AGENT_PROMPT_VERSION = "v4" as const;
export const NOTE_AGENT_NAME = "note-processing" as const;

/**
 * Cheap one-shot extraction prompt. No tools, no graph schema — resolution is deterministic.
 */
export function buildNoteAgentPrompt(): ComposedPrompt {
  const examples = EXTRACTION_PROMPT_EXAMPLES.map((example) =>
    [
      `### ${example.id}`,
      `Note: ${JSON.stringify(example.note)}`,
      "Expected draft (resolver fills track matches later):",
      "```json",
      JSON.stringify(
        {
          noteType: example.expected.noteType,
          mentions: example.expected.songMentions.map((song, index) => ({
            mentionId: `m${index + 1}`,
            mention: song.mention,
            titleHint: song.titleHint ?? null,
            artistHint: song.artistHint ?? null,
            confidence: null,
            ambiguityReason: null,
          })),
          transitions: example.expected.transitionProposals.map((transition) => ({
            fromMentionId: "m1",
            toMentionId: "m2",
            fromBar: "fromBar" in transition ? (transition.fromBar ?? null) : null,
            toBar: "toBar" in transition ? (transition.toBar ?? null) : null,
            barsOverlap: null,
            technique: "technique" in transition ? (transition.technique ?? null) : null,
            intent: "intent" in transition ? (transition.intent ?? null) : null,
            quality: "quality" in transition ? (transition.quality ?? null) : null,
            notes: null,
          })),
          confidence: example.expected.confidence,
          ambiguities: example.expected.ambiguities,
        },
        null,
        2,
      ),
      "```",
    ].join("\n"),
  ).join("\n\n");

  return composeAgentSystemPrompt({
    promptVersion: NOTE_AGENT_PROMPT_VERSION,
    outputSchema: NoteExtractionDraftSchema,
    outputSchemaTitle: "Note extraction draft schema",
    sections: [
      {
        id: "identity",
        title: "Identity",
        body: "You extract structured DJ mix-note drafts. You do not search catalogs or the library.",
      },
      {
        id: "objective",
        title: "Objective",
        body: [
          "1. Identify song mentions and optional transition proposals from the note text.",
          "2. Return one JSON draft in a single response.",
          "3. Never assume every note is a transition. Empty mentions/transitions are valid.",
          "4. Downstream code will match titles/artists to the library and Spotify.",
        ].join("\n"),
      },
      {
        id: "rules",
        title: "Rules",
        body: [
          "- Never invent track titles, artists, bars, techniques, or intents not implied by the note.",
          "- Prefer seeded technique/intent spellings when clear (high_pass_filter, cool_down, …).",
          "- Put title/artist guesses in titleHint/artistHint when possible.",
          "- If a mention is unclear, keep it and add an ambiguities entry / ambiguityReason.",
          "- If no song is recognizable, noteType=unknown with empty mentions/transitions.",
          "- Ordinary song notes without transitions are valid (noteType=song_note).",
          "- Include every schema key; use null for unknown optional fields (never omit keys).",
          "- Do not invent track ids or catalog ids.",
        ].join("\n"),
      },
      {
        id: "examples",
        title: "Few-shot examples",
        body: examples,
      },
    ],
  });
}

export function buildNoteAgentUserPrompt(rawNote: string): string {
  return ["Extract a structured draft from this DJ note:", "", rawNote.trim()].join("\n");
}
