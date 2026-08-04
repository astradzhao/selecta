import { composeAgentSystemPrompt, type ComposedPrompt } from "@selecta/agentics";

import { EXTRACTION_PROMPT_EXAMPLES } from "../extraction-prompt";
import { NoteProcessingPlanSchema } from "./schema";

export const NOTE_AGENT_PROMPT_VERSION = "v2" as const;
export const NOTE_AGENT_NAME = "note-processing" as const;

export type BuildNoteAgentPromptInput = {
  graphSchemaText: string;
};

export function buildNoteAgentPrompt(input: BuildNoteAgentPromptInput): ComposedPrompt {
  const examples = EXTRACTION_PROMPT_EXAMPLES.map((example) =>
    [
      `### ${example.id}`,
      `Note: ${JSON.stringify(example.note)}`,
      "Expected shape (illustrative — use candidate handles from tools when resolving):",
      "```json",
      JSON.stringify(
        {
          noteType: example.expected.noteType,
          mentions: example.expected.songMentions.map((song, index) => ({
            mentionId: `m${index + 1}`,
            mention: song.mention,
            titleHint: song.titleHint,
            artistHint: song.artistHint,
            selectedCandidateId: null,
            resolutionStatus: "unresolved",
          })),
          transitions: example.expected.transitionProposals.map((transition) => ({
            fromMentionId: "m1",
            toMentionId: "m2",
            fromBar: "fromBar" in transition ? (transition.fromBar ?? null) : null,
            toBar: "toBar" in transition ? (transition.toBar ?? null) : null,
            technique: "technique" in transition ? transition.technique : undefined,
            intent: "intent" in transition ? transition.intent : undefined,
            quality: "quality" in transition ? transition.quality : undefined,
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
    outputSchema: NoteProcessingPlanSchema,
    outputSchemaTitle: "Note processing plan schema",
    sections: [
      {
        id: "identity",
        title: "Identity",
        body: "You are a fast DJ note-processing agent. Parse free-form mix notes into a structured plan.",
      },
      {
        id: "objective",
        title: "Objective",
        body: [
          "1. Identify song mentions and optional transition proposals.",
          "2. Optionally search the local library and Spotify via tools to gather candidate handles.",
          "3. Return one JSON plan. Prefer 1–3 model steps; finish as soon as the plan is solid.",
          "4. Never assume every note is a transition. Empty mentions/transitions are valid.",
        ].join("\n"),
      },
      {
        id: "graph-schema",
        title: "Neo4j graph schema (read-only context)",
        body: input.graphSchemaText,
      },
      {
        id: "tools",
        title: "Tools",
        body: [
          "- searchLibraryTracks: local Neo4j library search (returns graph:<trackId> handles)",
          "- searchSpotifyTracks: Spotify catalog search (returns spotify:<providerId> handles)",
          "Batch up to 4 mention queries per call. At most 5 candidates each.",
          "Do not invent handles. selectedCandidateId must be null or a handle returned by tools in this run.",
          "You cannot create tracks or write transitions — the application applies policy after your plan.",
        ].join("\n"),
      },
      {
        id: "rules",
        title: "Rules",
        body: [
          "- Never invent track titles, artists, bars, techniques, or intents not implied by the note.",
          "- Prefer seeded technique/intent spellings when clear (high_pass_filter, cool_down, …).",
          "- If a mention is ambiguous, set resolutionStatus to ambiguous and explain in ambiguityReason / ambiguities.",
          "- If no song is recognizable, noteType=unknown with empty mentions/transitions.",
          "- Ordinary song notes without transitions are valid (noteType=song_note).",
          "- After at most one refinement search, produce the final JSON plan (tools will be disabled).",
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
  return ["Process this DJ note into a structured plan:", "", rawNote.trim()].join("\n");
}
