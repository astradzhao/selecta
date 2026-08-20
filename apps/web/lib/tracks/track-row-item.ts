import type { CatalogTrack } from "@/lib/catalog/types";
import type { ArtistInput } from "@/lib/format";
import type { ApiTrack } from "@/lib/tracks/types";

export type TrackRowItem = {
  key: string;
  title: string;
  artists: ArtistInput;
  artworkUrl?: string | null;
};

/** Artwork sizes owned by TrackRow — do not introduce a third. */
export const TRACK_ROW_ARTWORK_PX = {
  sm: 40,
  md: 48,
} as const;

export type TrackRowSize = keyof typeof TRACK_ROW_ARTWORK_PX;

export function rowFromApiTrack(
  track: Pick<ApiTrack, "id" | "title" | "artists" | "artworkUrl">,
): TrackRowItem {
  return {
    key: track.id,
    title: track.title,
    artists: track.artists,
    artworkUrl: track.artworkUrl,
  };
}

export function rowFromCatalogTrack(track: CatalogTrack): TrackRowItem {
  return {
    key: `${track.provider}:${track.providerId}`,
    title: track.title,
    artists: track.artists,
    artworkUrl: track.artworkUrl,
  };
}
