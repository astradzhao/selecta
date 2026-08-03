/** Browser client for @selecta/api via same-origin `/backend` rewrite. */

export type ApiNamedNode = {
  id: string;
  name: string;
  nameNormalized: string;
};

export type ApiFolderNode = ApiNamedNode & {
  kind: "folder" | "playlist" | "section" | null;
};

export type ApiSong = {
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

export type CreateSongBody = {
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

export async function listSongs(
  input: {
    query?: string;
    subgenre?: string;
    folder?: string;
    limit?: number;
  } = {},
): Promise<{ ok: true; songs: ApiSong[] }> {
  const params = new URLSearchParams();
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.subgenre?.trim()) params.set("subgenre", input.subgenre.trim());
  if (input.folder?.trim()) params.set("folder", input.folder.trim());
  if (input.limit) params.set("limit", String(input.limit));
  const qs = params.toString();
  return apiFetch(`/songs${qs ? `?${qs}` : ""}`);
}

export async function getSong(id: string): Promise<{ ok: true; song: ApiSong }> {
  return apiFetch(`/songs/${encodeURIComponent(id)}`);
}

export async function createSong(body: CreateSongBody): Promise<{ ok: true; song: ApiSong }> {
  return apiFetch("/songs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
