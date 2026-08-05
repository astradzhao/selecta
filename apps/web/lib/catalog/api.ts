import { apiFetch } from "@/lib/api/client";

import type { CatalogTrack } from "./types";

export type { CatalogTrack } from "./types";

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
