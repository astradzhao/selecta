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
  finishAgentRun,
  listAgentRunsForNote,
  upsertTransitionCommit,
  getTransitionCommitByKey,
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
  addNoteTrackLink,
  listNoteTrackLinks,
  removeNoteTrackLink,
  type AddNoteTrackLinkInput,
} from "./note-track-links";
export * from "./schema";
