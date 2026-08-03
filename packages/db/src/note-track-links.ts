import { and, asc, eq } from "drizzle-orm";

import { getDb } from "./client";
import { NotesError } from "./errors";
import { getNoteById } from "./notes";
import { noteTrackLinks, type NoteTrackLink } from "./schema";

export type AddNoteTrackLinkInput = {
  trackId: string;
  role?: string | null;
};

function requireTrackId(trackId: string): string {
  const trimmed = trackId.trim();
  if (!trimmed) {
    throw new NotesError("invalid_input", "trackId is required.");
  }
  return trimmed;
}

function normalizeRole(role: string | null | undefined): string | null {
  if (role == null) return null;
  const trimmed = role.trim();
  return trimmed || null;
}

/** List manual track links for a note (stable order by createdAt). */
export async function listNoteTrackLinks(noteId: string): Promise<NoteTrackLink[]> {
  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotesError("not_found", `Note "${noteId.trim()}" was not found.`);
  }

  return getDb()
    .select()
    .from(noteTrackLinks)
    .where(eq(noteTrackLinks.noteId, note.id))
    .orderBy(asc(noteTrackLinks.createdAt));
}

/**
 * Add a manual note → track link.
 * Caller must validate that `trackId` exists in Neo4j before calling.
 * Idempotent for the same (noteId, trackId): returns the existing row.
 */
export async function addNoteTrackLink(
  noteId: string,
  input: AddNoteTrackLinkInput,
): Promise<{ link: NoteTrackLink; created: boolean }> {
  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotesError("not_found", `Note "${noteId.trim()}" was not found.`);
  }

  const trackId = requireTrackId(input.trackId);
  const role = normalizeRole(input.role);

  const [existing] = await getDb()
    .select()
    .from(noteTrackLinks)
    .where(and(eq(noteTrackLinks.noteId, note.id), eq(noteTrackLinks.trackId, trackId)))
    .limit(1);

  if (existing) {
    if (role !== existing.role) {
      const [updated] = await getDb()
        .update(noteTrackLinks)
        .set({ role })
        .where(eq(noteTrackLinks.id, existing.id))
        .returning();
      return { link: updated ?? existing, created: false };
    }
    return { link: existing, created: false };
  }

  const [row] = await getDb()
    .insert(noteTrackLinks)
    .values({ noteId: note.id, trackId, role })
    .returning();

  if (!row) {
    throw new NotesError("invalid_input", "Failed to create note track link.");
  }
  return { link: row, created: true };
}

/** Remove a manual note → track link. */
export async function removeNoteTrackLink(noteId: string, trackId: string): Promise<void> {
  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotesError("not_found", `Note "${noteId.trim()}" was not found.`);
  }

  const targetTrackId = requireTrackId(trackId);
  const deleted = await getDb()
    .delete(noteTrackLinks)
    .where(and(eq(noteTrackLinks.noteId, note.id), eq(noteTrackLinks.trackId, targetTrackId)))
    .returning({ id: noteTrackLinks.id });

  if (deleted.length === 0) {
    throw new NotesError(
      "not_found",
      `Track link "${targetTrackId}" was not found on note "${note.id}".`,
    );
  }
}
