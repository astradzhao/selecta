/** Supported external music catalog providers. */
export const CATALOG_PROVIDERS = ["spotify"] as const;

export type CatalogProviderId = (typeof CATALOG_PROVIDERS)[number];

/**
 * Normalized track hit from an external catalog.
 * Not persisted until the user confirms import (DJ-26).
 */
export type CatalogTrack = {
  provider: CatalogProviderId;
  providerId: string;
  title: string;
  artists: string[];
  artworkUrl: string | null;
  durationMs: number | null;
  /** Provider release date string (year, year-month, or full date). */
  releaseDate: string | null;
  /** Provider genre metadata when available (often empty for Spotify track search). */
  genres: string[];
};

export type CatalogSearchOptions = {
  /** Max results (clamped per provider; default 20). */
  limit?: number;
};

export type CatalogSearchResult = {
  provider: CatalogProviderId;
  query: string;
  results: CatalogTrack[];
};

export type CatalogStatus = {
  configured: boolean;
  provider: CatalogProviderId | null;
  ok?: boolean;
  error?: string;
};

export type MusicCatalogProvider = {
  readonly id: CatalogProviderId;
  searchTracks(query: string, options?: CatalogSearchOptions): Promise<CatalogTrack[]>;
};
