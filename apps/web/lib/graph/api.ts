import { apiFetch } from "@/lib/api/client";
import type { ApiNeighborhoodCurrent, ApiNeighborhoodNeighbor } from "@/lib/graph/types";

export type {
  ApiNeighborhoodCurrent,
  ApiNeighborhoodNeighbor,
  ApiTransitionEdge,
} from "@/lib/graph/types";

export async function getTrackNeighborhood(id: string): Promise<{
  ok: true;
  current: ApiNeighborhoodCurrent;
  neighbors: ApiNeighborhoodNeighbor[];
}> {
  return apiFetch(`/tracks/${encodeURIComponent(id)}/neighborhood`);
}
