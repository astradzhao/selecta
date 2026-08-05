import { apiFetch } from "@/lib/api/client";

import type { CatalogTrack } from "./types";

export type { CatalogTrack } from "./types";

export async function searchCatalog(
  query: string,
  /** Spotify `/v1/search` currently caps at 10; higher values 400. */
  limit = 10,
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
