import { apiFetch } from "@/lib/api/client";

import type { ApiNote, ApiNoteTrackLink, NoteExtractionStatus } from "./types";

export type {
  ApiNote,
  ApiNoteProposalCounts,
  ApiNoteProposalLink,
  ApiNoteTrackLink,
  NoteExtractionStatus,
} from "./types";

export async function listNotes(
  input: {
    query?: string;
    status?: NoteExtractionStatus;
    needsReview?: boolean;
    createdAfter?: string;
    createdBefore?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  ok: true;
  notes: ApiNote[];
  submissions: ApiNote[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.status) params.set("status", input.status);
  if (input.needsReview === true) params.set("needsReview", "true");
  if (input.needsReview === false) params.set("needsReview", "false");
  if (input.createdAfter) params.set("createdAfter", input.createdAfter);
  if (input.createdBefore) params.set("createdBefore", input.createdBefore);
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  const qs = params.toString();
  return apiFetch(`/notes${qs ? `?${qs}` : ""}`);
}

/** Alias for Library Submissions view (same endpoint as notes). */
export async function listSubmissions(input: Parameters<typeof listNotes>[0] = {}): Promise<{
  ok: true;
  notes: ApiNote[];
  submissions: ApiNote[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  return listNotes(input);
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
