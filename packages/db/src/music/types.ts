import type { FolderKind } from "../schema";
import { isFolderKind } from "./constants";
import { MusicWriteError } from "./errors";
import type { ListPageMeta } from "./list-page";

export type NamedRef = {
  /** Existing row id — preferred when linking known Subgenre/Folder. */
  id?: string;
  /** Display name — used to ensure when id is omitted. */
  name?: string;
};

export type FolderRef = NamedRef & {
  /** Optional product copy only. */
  kind?: FolderKind;
};

/** Provider → external id map (e.g. `{ spotify: "…" }`). */
export type TrackExternalIds = Record<string, string>;

export type CreateTrackInput = {
  title: string;
  /** At least one artist name required. */
  artists: string[];
  /** Optional provider catalog genres. */
  genres?: string[];
  /** Optional DJ musical labels. */
  subgenres?: NamedRef[];
  /** Optional organizational containers. */
  folders?: FolderRef[];
  externalIds?: TrackExternalIds;
  artworkUrl?: string | null;
  durationSec?: number | null;
  releaseDate?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  energy?: number | null;
  libraryId?: string | null;
};

export type NamedNode = {
  id: string;
  name: string;
  nameNormalized: string;
};

export type FolderNode = NamedNode & {
  kind: FolderKind | null;
};

export type TrackNode = {
  id: string;
  title: string;
  bpm: number | null;
  musicalKey: string | null;
  durationSec: number | null;
  energy: number | null;
  artworkUrl: string | null;
  releaseDate: string | null;
  externalIds: Record<string, string>;
  libraryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TrackSummary = {
  track: TrackNode;
  artists: NamedNode[];
  genres: NamedNode[];
  subgenres: NamedNode[];
  folders: FolderNode[];
};

export type TrackDetail = TrackSummary & {
  hasOutboundTransitions: boolean;
  hasInboundTransitions: boolean;
};

export type CreateTrackResult = TrackSummary & {
  /** False when an existing track was matched by external provider id. */
  created: boolean;
};

export type LibraryStats = {
  count: number;
  /** ISO timestamp of the most recently updated track, or null when empty. */
  latestUpdatedAt: string | null;
};

export type TrackSortField = "title" | "createdAt" | "updatedAt";
export type ListSortOrder = "asc" | "desc";

export type ListTracksInput = {
  /** Free-form match against track title and artist names. */
  query?: string;
  subgenreId?: string;
  subgenre?: string;
  folderId?: string;
  folder?: string;
  /** Inclusive lower bound on createdAt (ISO string). */
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  sort?: TrackSortField;
  order?: ListSortOrder;
  limit?: number;
  offset?: number;
};

export type ListTracksResult = {
  tracks: TrackSummary[];
} & ListPageMeta;

export function assertFolderKind(value: string | undefined): FolderKind | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isFolderKind(value)) {
    throw new MusicWriteError(
      "invalid_input",
      `Invalid folder kind "${value}". Expected folder | playlist.`,
    );
  }
  return value;
}
