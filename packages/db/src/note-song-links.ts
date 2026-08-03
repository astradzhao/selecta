import { and, asc, eq } from "drizzle-orm";

import { getDb } from "./client";
import { NotesError } from "./errors";
import { getNoteById } from "./notes";
import { noteSongLinks, type NoteSongLink } from "./schema";

export type AddNoteSongLinkInput = {
  songId: string;
  role?: string | null;
};

function requireSongId(songId: string): string {
  const trimmed = songId.trim();
  if (!trimmed) {
    throw new NotesError("invalid_input", "songId is required.");
  }
  return trimmed;
}

function normalizeRole(role: string | null | undefined): string | null {
  if (role == null) return null;
  const trimmed = role.trim();
  return trimmed || null;
}

/** List manual song links for a note (stable order by createdAt). */
export async function listNoteSongLinks(noteId: string): Promise<NoteSongLink[]> {
  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotesError("not_found", `Note "${noteId.trim()}" was not found.`);
  }

  return getDb()
    .select()
    .from(noteSongLinks)
    .where(eq(noteSongLinks.noteId, note.id))
    .orderBy(asc(noteSongLinks.createdAt));
}

/**
 * Add a manual note → song link.
 * Caller must validate that `songId` exists in Neo4j before calling.
 * Idempotent for the same (noteId, songId): returns the existing row.
 */
export async function addNoteSongLink(
  noteId: string,
  input: AddNoteSongLinkInput,
): Promise<{ link: NoteSongLink; created: boolean }> {
  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotesError("not_found", `Note "${noteId.trim()}" was not found.`);
  }

  const songId = requireSongId(input.songId);
  const role = normalizeRole(input.role);

  const [existing] = await getDb()
    .select()
    .from(noteSongLinks)
    .where(and(eq(noteSongLinks.noteId, note.id), eq(noteSongLinks.songId, songId)))
    .limit(1);

  if (existing) {
    if (role !== existing.role) {
      const [updated] = await getDb()
        .update(noteSongLinks)
        .set({ role })
        .where(eq(noteSongLinks.id, existing.id))
        .returning();
      return { link: updated ?? existing, created: false };
    }
    return { link: existing, created: false };
  }

  const [row] = await getDb()
    .insert(noteSongLinks)
    .values({ noteId: note.id, songId, role })
    .returning();

  if (!row) {
    throw new NotesError("invalid_input", "Failed to create note song link.");
  }
  return { link: row, created: true };
}

/** Remove a manual note → song link. */
export async function removeNoteSongLink(noteId: string, songId: string): Promise<void> {
  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotesError("not_found", `Note "${noteId.trim()}" was not found.`);
  }

  const targetSongId = requireSongId(songId);
  const deleted = await getDb()
    .delete(noteSongLinks)
    .where(and(eq(noteSongLinks.noteId, note.id), eq(noteSongLinks.songId, targetSongId)))
    .returning({ id: noteSongLinks.id });

  if (deleted.length === 0) {
    throw new NotesError(
      "not_found",
      `Song link "${targetSongId}" was not found on note "${note.id}".`,
    );
  }
}
