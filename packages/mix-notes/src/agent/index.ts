import type { ComposedPrompt } from "@selecta/agentics";
import type { z } from "zod";

import type { NoteAgentServices } from "./services";
import { createNoteAgentTools, type NoteAgentToolSet } from "./tools";
import { buildNoteAgentPrompt, NOTE_AGENT_NAME, NOTE_AGENT_PROMPT_VERSION } from "./prompt";
import { NoteExtractionDraftSchema, type NoteExtractionDraft } from "./schema";
import { DEFAULT_NOTE_AGENT_MODEL } from "./run-note-agent";

export type CreateNoteAgentConfig = {
  services: NoteAgentServices;
  model?: string;
};

export type CreatedNoteAgent = {
  name: typeof NOTE_AGENT_NAME;
  model: string;
  promptVersion: typeof NOTE_AGENT_PROMPT_VERSION;
  prompt: ComposedPrompt;
  /** Reserved for future tool-loop agents; production path is one-shot + resolve. */
  tools: NoteAgentToolSet;
  outputSchema: z.ZodType<NoteExtractionDraft>;
};

/**
 * Introspection/factory helpers. Production processing uses `runNoteAgent`
 * (one-shot extract + deterministic resolve). Tool wiring is kept for future agents
 * that may use `@selecta/agentics` `runBoundedAgent`.
 */
export function createNoteAgent(config: CreateNoteAgentConfig): CreatedNoteAgent {
  const prompt = buildNoteAgentPrompt();
  const tools = createNoteAgentTools(config.services);
  return {
    name: NOTE_AGENT_NAME,
    model: config.model?.trim() || DEFAULT_NOTE_AGENT_MODEL,
    promptVersion: NOTE_AGENT_PROMPT_VERSION,
    prompt,
    tools,
    outputSchema: NoteExtractionDraftSchema,
  };
}
