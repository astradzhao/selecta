/** External music catalog search (provider adapters; no persistence). */

export type {
  CatalogProviderId,
  CatalogTrack,
  CatalogSearchOptions,
  CatalogSearchResult,
  CatalogStatus,
  MusicCatalogProvider,
} from "./types";

export { CATALOG_PROVIDERS } from "./types";

export { CatalogError, isCatalogError, type CatalogErrorCode } from "./errors";

export { getCatalogProvider, getCatalogStatus, isCatalogConfigured, searchCatalog } from "./search";

export {
  clearSpotifyTokenCache,
  createSpotifyProvider,
  isSpotifyConfigured,
  normalizeSpotifyTrack,
  readSpotifyCredentials,
  type SpotifySearchTrack,
} from "./providers/spotify";
