/** Postgres client + notes schema (single-user MVP; membership deferred). */

export { getDb, getDbStatus, isPostgresConfigured, type DbStatus } from "./client";
export { NotesError, isNotesError } from "./errors";
export {
  createNote,
  getNoteById,
  listNotes,
  updateNote,
  type CreateNoteInput,
  type ListNotesInput,
  type UpdateNoteInput,
} from "./notes";
export {
  addNoteSongLink,
  listNoteSongLinks,
  removeNoteSongLink,
  type AddNoteSongLinkInput,
} from "./note-song-links";
export * from "./schema";
