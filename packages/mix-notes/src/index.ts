/** NL parse / preview / commit orchestration + schemas (M3). */

import { EXTRACTION_PROMPT_VERSION } from "./extraction-prompt";

export {
  NOTE_TYPES,
  TRANSITION_QUALITIES,
  SongMentionSchema,
  TransitionProposalSchema,
  ExtractionProposalSchema,
  parseExtractionProposal,
  safeParseExtractionProposal,
  type NoteType,
  type TransitionQuality,
  type SongMention,
  type TransitionProposal,
  type ExtractionProposal,
} from "./extraction-schema";

export {
  EXTRACTION_PROMPT_VERSION,
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_PROMPT_EXAMPLES,
  getExtractionPromptMeta,
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  buildExtractionMessages,
  type ExtractionPromptMeta,
  type ExtractionPromptExample,
  type ExtractionPromptMessage,
} from "./extraction-prompt";

export {
  extractNoteProposals,
  hasTransitionProposals,
  providerFromModel,
  type ExtractNoteProposalsInput,
  type ExtractNoteProposalsResult,
} from "./extract-note";

export function getMixNotesStatus() {
  return {
    configured: true as const,
    feature: "mix-notes" as const,
    promptVersion: EXTRACTION_PROMPT_VERSION,
  };
}
