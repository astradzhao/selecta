/** NL parse / preview / commit orchestration + schemas (M3). */

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

export function getMixNotesStatus() {
  return { configured: false as const, feature: "mix-notes" as const };
}
