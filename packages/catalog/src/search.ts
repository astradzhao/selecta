import { CatalogError } from "./errors";
import {
  createSpotifyProvider,
  isSpotifyConfigured,
  readSpotifyCredentials,
} from "./providers/spotify";
import type {
  CatalogSearchOptions,
  CatalogSearchResult,
  CatalogStatus,
  MusicCatalogProvider,
} from "./types";

const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 200;

export function isCatalogConfigured(): boolean {
  return isSpotifyConfigured();
}

/** Active provider for this process (Spotify when credentials exist). */
export function getCatalogProvider(): MusicCatalogProvider {
  const credentials = readSpotifyCredentials();
  if (!credentials) {
    throw new CatalogError(
      "not_configured",
      "No music catalog provider is configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
      { provider: null },
    );
  }
  return createSpotifyProvider(credentials);
}

export function getCatalogStatus(): CatalogStatus {
  if (!isSpotifyConfigured()) {
    return {
      configured: false,
      provider: null,
      ok: false,
      error: "not configured",
    };
  }
  return {
    configured: true,
    provider: "spotify",
    ok: true,
  };
}

function normalizeQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    throw new CatalogError("invalid_query", "Search query must not be empty.");
  }
  if (trimmed.length > MAX_QUERY_LENGTH) {
    throw new CatalogError(
      "invalid_query",
      `Search query must be at most ${MAX_QUERY_LENGTH} characters.`,
    );
  }
  return trimmed;
}

/**
 * Search the configured external catalog.
 * Does not persist results — import confirmation is DJ-26.
 */
export async function searchCatalog(
  query: string,
  options?: CatalogSearchOptions,
): Promise<CatalogSearchResult> {
  const normalized = normalizeQuery(query);
  const provider = getCatalogProvider();
  const results = await provider.searchTracks(normalized, options);
  return {
    provider: provider.id,
    query: normalized,
    results,
  };
}
