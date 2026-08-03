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
  type CreateNoteInput,
  type ListNotesInput,
  type UpdateNoteInput,
  type UpdateNoteResult,
  type CompleteExtractionInput,
} from "./notes";
export {
  addNoteTrackLink,
  listNoteTrackLinks,
  removeNoteTrackLink,
  type AddNoteTrackLinkInput,
} from "./note-track-links";
export * from "./schema";
