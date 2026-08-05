/** Shared graph node shapes returned on tracks and note links. */

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

/** Transition edge fields on neighborhood neighbors (DJ-40). */
export type ApiTransitionEdge = {
  proposalKey: string | null;
  sourceNoteId: string | null;
  sourceNoteVersion: number | null;
  confidence: number | null;
  fromBar: number | null;
  toBar: number | null;
  barsOverlap: number | null;
  technique: string | null;
  intent: string | null;
  quality: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ApiNeighborhoodNeighbor = Omit<
  ApiTrack,
  "created" | "hasOutboundTransitions" | "hasInboundTransitions"
> & {
  transition: ApiTransitionEdge;
};

export type ApiNeighborhoodCurrent = Omit<
  ApiTrack,
  "created" | "hasOutboundTransitions" | "hasInboundTransitions"
>;
