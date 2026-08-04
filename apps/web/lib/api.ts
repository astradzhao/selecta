/** Browser client for @selecta/api via same-origin `/backend` rewrite. */

export type ApiNamedNode = {
  id: string;
  name: string;
  nameNormalized: string;
};

export type ApiFolderNode = ApiNamedNode & {
  kind: "folder" | "playlist" | "section" | null;
};

export type ApiTrack = {
  id: string;
  title: string;
  artists: ApiNamedNode[];
  genres: ApiNamedNode[];
  subgenres: ApiNamedNode[];
  folders: ApiFolderNode[];
  artworkUrl: string | null;
  durationSec: number | null;
  releaseDate: string | null;
  bpm: number | null;
  musicalKey: string | null;
  energy: number | null;
  externalIds: Record<string, string>;
  libraryId: string | null;
  createdAt: string;
  updatedAt: string;
  created?: boolean;
  hasOutboundTransitions?: boolean;
  hasInboundTransitions?: boolean;
};

export type CatalogTrack = {
  provider: string;
  providerId: string;
  title: string;
  artists: string[];
  artworkUrl: string | null;
  durationMs: number | null;
  releaseDate: string | null;
  genres: string[];
};

export type NamedRefInput = {
  id?: string;
  name?: string;
};

export type FolderRefInput = NamedRefInput & {
  kind?: "folder" | "playlist" | "section";
};

export type CreateTrackBody = {
  catalog?: {
    provider: string;
    providerId: string;
    title: string;
    artists: string[];
    artworkUrl?: string | null;
    durationMs?: number | null;
    releaseDate?: string | null;
    genres?: string[];
  };
  title?: string;
  artists?: string[];
  genres?: string[];
  subgenres?: NamedRefInput[];
  folders?: FolderRefInput[];
  artworkUrl?: string | null;
  durationSec?: number | null;
  durationMs?: number | null;
  releaseDate?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  energy?: number | null;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorBody = {
  ok?: boolean;
  error?: string;
  message?: string;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/backend${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = (body ?? {}) as ApiErrorBody;
    throw new ApiClientError(
      response.status,
      errorBody.error ?? "request_failed",
      errorBody.message ?? `Request failed (${response.status}).`,
    );
  }

  return body as T;
}

export async function searchCatalog(
  query: string,
  limit = 12,
): Promise<{
  ok: true;
  provider: string;
  query: string;
  results: CatalogTrack[];
}> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  return apiFetch(`/catalog/search?${params}`);
}

export async function listTracks(
  input: {
    query?: string;
    subgenre?: string;
    folder?: string;
    limit?: number;
  } = {},
): Promise<{ ok: true; tracks: ApiTrack[] }> {
  const params = new URLSearchParams();
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.subgenre?.trim()) params.set("subgenre", input.subgenre.trim());
  if (input.folder?.trim()) params.set("folder", input.folder.trim());
  if (input.limit) params.set("limit", String(input.limit));
  const qs = params.toString();
  return apiFetch(`/tracks${qs ? `?${qs}` : ""}`);
}

export async function getLibraryStats(): Promise<{
  ok: true;
  count: number;
  latestUpdatedAt: string | null;
}> {
  return apiFetch("/tracks/stats");
}

export async function getTrack(id: string): Promise<{ ok: true; track: ApiTrack }> {
  return apiFetch(`/tracks/${encodeURIComponent(id)}`);
}

export async function createTrack(body: CreateTrackBody): Promise<{ ok: true; track: ApiTrack }> {
  return apiFetch("/tracks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type NoteStatus = "draft" | "preview" | "committed";

export type NoteExtractionStatus =
  | "idle"
  | "extracting"
  | "no_proposal"
  | "resolving"
  | "needs_review"
  | "committed"
  | "commit_failed"
  | "failed";

export type ApiNoteTrackLink = {
  id: string;
  trackId: string;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  track: {
    id: string;
    title: string;
    artists: ApiNamedNode[];
    artworkUrl: string | null;
  } | null;
};

export type ApiNote = {
  id: string;
  rawText: string;
  status: NoteStatus;
  extractionStatus: NoteExtractionStatus;
  extractionVersion: number;
  extractionError: string | null;
  extractionConfidence: number | null;
  extractionStartedAt: string | null;
  extractionFinishedAt: string | null;
  extraction: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  rawResponse: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  trackLinks?: ApiNoteTrackLink[];
};

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
