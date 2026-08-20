/** Shared named-node shapes returned on tracks and submission links. */

export type ApiNamedNode = {
  id: string;
  name: string;
  nameNormalized: string;
};

export type ApiFolderNode = ApiNamedNode & {
  kind: "folder" | "playlist" | "section" | null;
};

export type ApiTrack = {
  id: string;
  title: string;
  artists: ApiNamedNode[];
  genres: ApiNamedNode[];
  subgenres: ApiNamedNode[];
  folders: ApiFolderNode[];
  artworkUrl: string | null;
  durationSec: number | null;
  releaseDate: string | null;
  bpm: number | null;
  musicalKey: string | null;
  energy: number | null;
  externalIds: Record<string, string>;
  libraryId: string | null;
  createdAt: string;
  updatedAt: string;
  created?: boolean;
  hasOutboundTransitions?: boolean;
  hasInboundTransitions?: boolean;
};

export type NamedRefInput = {
  id?: string;
  name?: string;
};

export type FolderRefInput = NamedRefInput & {
  kind?: "folder" | "playlist" | "section";
};

export type CreateTrackBody = {
  catalog?: {
    provider: string;
    providerId: string;
    title: string;
    artists: string[];
    artworkUrl?: string | null;
    durationMs?: number | null;
    releaseDate?: string | null;
    genres?: string[];
  };
  title?: string;
  artists?: string[];
  genres?: string[];
  subgenres?: NamedRefInput[];
  folders?: FolderRefInput[];
  artworkUrl?: string | null;
  durationSec?: number | null;
  durationMs?: number | null;
  releaseDate?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  energy?: number | null;
};

/** Partial patch for track edit — omit fields to leave them unchanged. */
export type UpdateTrackBody = {
  title?: string;
  artists?: string[];
  genres?: string[];
  subgenres?: NamedRefInput[];
  folders?: FolderRefInput[];
  artworkUrl?: string | null;
  durationSec?: number | null;
  releaseDate?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  energy?: number | null;
};
