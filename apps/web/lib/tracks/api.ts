import { apiFetch } from "@/lib/api/client";

import type { ApiTrack, CreateTrackBody, UpdateTrackBody } from "./types";

export type {
  ApiFolderNode,
  ApiNamedNode,
  ApiTrack,
  CreateTrackBody,
  FolderRefInput,
  NamedRefInput,
  UpdateTrackBody,
} from "./types";

export async function listTracks(
  input: {
    query?: string;
    subgenre?: string;
    folder?: string;
    sort?: "title" | "createdAt" | "updatedAt";
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  ok: true;
  tracks: ApiTrack[];
  limit?: number;
  offset?: number;
  hasMore?: boolean;
}> {
  const params = new URLSearchParams();
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.subgenre?.trim()) params.set("subgenre", input.subgenre.trim());
  if (input.folder?.trim()) params.set("folder", input.folder.trim());
  if (input.sort) params.set("sort", input.sort);
  if (input.order) params.set("order", input.order);
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  const qs = params.toString();
  return apiFetch(`/tracks${qs ? `?${qs}` : ""}`);
}

export async function getLibraryStats(): Promise<{
  ok: true;
  count: number;
  latestUpdatedAt: string | null;
  transitionCount: number;
  latestTransitionUpdatedAt: string | null;
  deadEndCount: number;
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

export async function updateTrack(
  id: string,
  body: UpdateTrackBody,
): Promise<{ ok: true; track: ApiTrack }> {
  return apiFetch(`/tracks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTrack(id: string): Promise<{ ok: true; id: string; deleted: boolean }> {
  return apiFetch(`/tracks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
