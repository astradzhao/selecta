import { apiFetch } from "@/lib/api/client";

import type { ApiNote, ApiNoteTrackLink } from "./types";

export type { ApiNote, ApiNoteTrackLink, NoteExtractionStatus } from "./types";

export async function listNotes(
  input: { limit?: number } = {},
): Promise<{ ok: true; notes: ApiNote[] }> {
  const params = new URLSearchParams();
  if (input.limit) params.set("limit", String(input.limit));
  const qs = params.toString();
  return apiFetch(`/notes${qs ? `?${qs}` : ""}`);
}

export async function getNote(id: string): Promise<{ ok: true; note: ApiNote }> {
  return apiFetch(`/notes/${encodeURIComponent(id)}`);
}

export async function createNote(body: { rawText: string }): Promise<{ ok: true; note: ApiNote }> {
  return apiFetch("/notes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateNote(
  id: string,
  body: { rawText: string },
): Promise<{ ok: true; note: ApiNote }> {
  return apiFetch(`/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Retry extraction for the current note version. */
export async function extractNote(id: string): Promise<{ ok: true; note: ApiNote }> {
  return apiFetch(`/notes/${encodeURIComponent(id)}/extract`, {
    method: "POST",
  });
}

export async function addNoteTrackLink(
  noteId: string,
  body: { trackId: string; role?: string | null },
): Promise<{
  ok: true;
  trackLink: ApiNoteTrackLink;
  trackLinks: ApiNoteTrackLink[];
  note?: ApiNote;
}> {
  return apiFetch(`/notes/${encodeURIComponent(noteId)}/tracks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function removeNoteTrackLink(
  noteId: string,
  trackId: string,
): Promise<{ ok: true; trackLinks: ApiNoteTrackLink[]; note?: ApiNote }> {
  return apiFetch(`/notes/${encodeURIComponent(noteId)}/tracks/${encodeURIComponent(trackId)}`, {
    method: "DELETE",
  });
}
