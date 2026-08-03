import { desc, eq } from "drizzle-orm";

import { getDb } from "./client";
import { NotesError } from "./errors";
import { notes, type Note } from "./schema";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type CreateNoteInput = {
  rawText: string;
};

export type UpdateNoteInput = {
  rawText: string;
};

export type ListNotesInput = {
  limit?: number;
};

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function requireRawText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new NotesError("invalid_input", "rawText is required.");
  }
  return trimmed;
}

/**
 * Create a free-form note from raw text alone (status defaults to draft).
 * No song links or extraction required.
 */
export async function createNote(input: CreateNoteInput): Promise<Note> {
  const rawText = requireRawText(input.rawText);
  const [row] = await getDb().insert(notes).values({ rawText }).returning();
  if (!row) {
    throw new NotesError("invalid_input", "Failed to create note.");
  }
  return row;
}

/** List notes newest-first. */
export async function listNotes(input: ListNotesInput = {}): Promise<Note[]> {
  const limit = clampLimit(input.limit);
  return getDb().select().from(notes).orderBy(desc(notes.createdAt)).limit(limit);
}

export async function getNoteById(id: string): Promise<Note | null> {
  const noteId = id.trim();
  if (!noteId) {
    throw new NotesError("invalid_input", "Note id is required.");
  }
  const [row] = await getDb().select().from(notes).where(eq(notes.id, noteId)).limit(1);
  return row ?? null;
}

/**
 * Update raw note text.
 * Preserves extraction/commit audit fields when status is `committed`.
 * Explicitly invalidates stale `preview` payloads (clears extraction audit + resets to draft).
 */
export async function updateNote(id: string, input: UpdateNoteInput): Promise<Note> {
  const noteId = id.trim();
  if (!noteId) {
    throw new NotesError("invalid_input", "Note id is required.");
  }
  const rawText = requireRawText(input.rawText);

  const existing = await getNoteById(noteId);
  if (!existing) {
    throw new NotesError("not_found", `Note "${noteId}" was not found.`);
  }

  const invalidatePreview = existing.status === "preview" && existing.rawText !== rawText;

  const [row] = await getDb()
    .update(notes)
    .set(
      invalidatePreview
        ? {
            rawText,
            status: "draft",
            extraction: null,
            model: null,
            promptVersion: null,
            rawResponse: null,
          }
        : { rawText },
    )
    .where(eq(notes.id, noteId))
    .returning();

  if (!row) {
    throw new NotesError("not_found", `Note "${noteId}" was not found.`);
  }
  return row;
}
