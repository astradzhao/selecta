/** Postgres client + notes schema (single-user MVP; membership deferred). */

export { getDb, getDbStatus, isPostgresConfigured, type DbStatus } from "./client";
export { NotesError, isNotesError } from "./errors";
export {
  createNote,
  getNoteById,
  listNotes,
  updateNote,
  requeueExtraction,
  completeExtraction,
  failExtraction,
  startAgentRun,
  attachWorkflowRunId,
  finishAgentRun,
  listAgentRunsForNote,
  upsertTransitionCommit,
  getTransitionCommitByKey,
  MAX_SUBMISSION_RAW_BYTES,
  type CreateNoteInput,
  type ListNotesInput,
  type UpdateNoteInput,
  type UpdateNoteResult,
  type CompleteExtractionInput,
  type StartAgentRunInput,
  type FinishAgentRunInput,
  type UpsertTransitionCommitInput,
} from "./notes";
export {
  claimProposal,
  getProposalByKey,
  getProposalById,
  listProposalsForVersion,
  updateProposal,
  supersedeProposalsForNote,
  countProposalsForVersion,
  deriveSubmissionExtractionStatus,
  type ClaimProposalInput,
  type ClaimProposalResult,
  type UpdateProposalInput,
  type ProposalStatusCounts,
} from "./proposals";
export {
  addNoteTrackLink,
  listNoteTrackLinks,
  removeNoteTrackLink,
  type AddNoteTrackLinkInput,
} from "./note-track-links";
export * from "./schema";
