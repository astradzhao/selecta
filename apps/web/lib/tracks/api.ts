import { apiFetch } from "@/lib/api/client";

import type {
  ApiNeighborhoodCurrent,
  ApiNeighborhoodNeighbor,
  ApiTrack,
  CreateTrackBody,
} from "./types";

export type {
  ApiFolderNode,
  ApiNamedNode,
  ApiNeighborhoodCurrent,
  ApiNeighborhoodNeighbor,
  ApiTrack,
  ApiTransitionEdge,
  CreateTrackBody,
  FolderRefInput,
  NamedRefInput,
} from "./types";

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

export async function getTrackNeighborhood(id: string): Promise<{
  ok: true;
  current: ApiNeighborhoodCurrent;
  neighbors: ApiNeighborhoodNeighbor[];
}> {
  return apiFetch(`/tracks/${encodeURIComponent(id)}/neighborhood`);
}

export async function createTrack(body: CreateTrackBody): Promise<{ ok: true; track: ApiTrack }> {
  return apiFetch("/tracks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
