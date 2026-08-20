import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@selecta/db";
import { NotesError } from "./errors";
import { getNoteById } from "./notes";
import { getTrackSummariesByIds } from "@selecta/library";
import { noteTrackLinks, tracks, type NoteTrackLink } from "@selecta/db/schema";
import type { TrackSummary } from "@selecta/library";

export type AddNoteTrackLinkInput = {
  trackId: string;
  role?: string | null;
};

export type NoteTrackLinkWithTrack = {
  link: NoteTrackLink;
  track: TrackSummary | null;
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
 * List note track links with library track summaries via a tracks LEFT JOIN
 * (orphans after Neo4j-era ids yield track: null until cleaned by FK migration).
 */
export async function listNoteTrackLinksWithTracks(
  noteId: string,
): Promise<NoteTrackLinkWithTrack[]> {
  const note = await getNoteById(noteId);
  if (!note) {
    throw new NotesError("not_found", `Note "${noteId.trim()}" was not found.`);
  }

  const rows = await getDb()
    .select({
      link: noteTrackLinks,
      trackId: tracks.id,
    })
    .from(noteTrackLinks)
    .leftJoin(tracks, eq(noteTrackLinks.trackId, tracks.id))
    .where(eq(noteTrackLinks.noteId, note.id))
    .orderBy(asc(noteTrackLinks.createdAt));

  const presentIds = rows
    .map((row) => row.trackId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const summaries =
    presentIds.length > 0
      ? await getTrackSummariesByIds(presentIds)
      : new Map<string, TrackSummary>();

  return rows.map((row) => ({
    link: row.link,
    track: row.trackId ? (summaries.get(row.trackId) ?? null) : null,
  }));
}

/**
 * Add a manual note → track link.
 * Caller must validate that `trackId` exists in the music store before calling.
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

  const [track] = await getDb()
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);
  if (!track) {
    throw new NotesError("not_found", `Track "${trackId}" was not found.`);
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
