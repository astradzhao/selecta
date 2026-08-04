import type { ComposedPrompt } from "@selecta/agentics";
import type { z } from "zod";

import type { NoteAgentServices } from "./services";
import { createNoteAgentTools, type NoteAgentToolSet } from "./tools";
import { buildNoteAgentPrompt, NOTE_AGENT_NAME, NOTE_AGENT_PROMPT_VERSION } from "./prompt";
import { NoteProcessingPlanSchema, type NoteProcessingPlan } from "./schema";
import { DEFAULT_NOTE_AGENT_MODEL } from "./run-note-agent";

export type CreateNoteAgentConfig = {
  services: NoteAgentServices;
  graphSchemaText: string;
  model?: string;
};

export type CreatedNoteAgent = {
  name: typeof NOTE_AGENT_NAME;
  model: string;
  promptVersion: typeof NOTE_AGENT_PROMPT_VERSION;
  prompt: ComposedPrompt;
  tools: NoteAgentToolSet;
  outputSchema: z.ZodType<NoteProcessingPlan>;
};

/**
 * Factory metadata + tools for the note agent (tests / introspection).
 * Production runs should call `runNoteAgent`.
 */
export function createNoteAgent(config: CreateNoteAgentConfig): CreatedNoteAgent {
  const prompt = buildNoteAgentPrompt({ graphSchemaText: config.graphSchemaText });
  const tools = createNoteAgentTools(config.services);
  return {
    name: NOTE_AGENT_NAME,
    model: config.model?.trim() || DEFAULT_NOTE_AGENT_MODEL,
    promptVersion: NOTE_AGENT_PROMPT_VERSION,
    prompt,
    tools,
    outputSchema: NoteProcessingPlanSchema,
  };
}
