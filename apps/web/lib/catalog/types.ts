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
