import { isFolderKind, type FolderKind } from "./schema";

export type NamedRef = {
  /** Existing node id — preferred when linking known Subgenre/Folder. */
  id?: string;
  /** Display name — used to MERGE when id is omitted. */
  name?: string;
};

export type FolderRef = NamedRef & {
  /** Optional product copy only — not a separate graph label. */
  kind?: FolderKind;
};

/** Provider → external id map (e.g. `{ spotify: "…" }`). */
export type SongExternalIds = Record<string, string>;

export type CreateSongInput = {
  title: string;
  /** At least one artist name required. */
  artists: string[];
  /** Optional provider catalog genres (Genre nodes + IN_GENRE). */
  genres?: string[];
  /** Optional DJ musical labels (Subgenre + IN_SUBGENRE). */
  subgenres?: NamedRef[];
  /** Optional organizational containers (Folder + IN_FOLDER). */
  folders?: FolderRef[];
  externalIds?: SongExternalIds;
  artworkUrl?: string | null;
  durationSec?: number | null;
  releaseDate?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  energy?: number | null;
  libraryId?: string | null;
};

export type GraphNamedNode = {
  id: string;
  name: string;
  nameNormalized: string;
};

export type GraphFolderNode = GraphNamedNode & {
  kind: FolderKind | null;
};

export type GraphSongNode = {
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

export type CreateSongResult = {
  song: GraphSongNode;
  artists: GraphNamedNode[];
  genres: GraphNamedNode[];
  subgenres: GraphNamedNode[];
  folders: GraphFolderNode[];
  /** False when an existing song was matched by external provider id. */
  created: boolean;
};

export class GraphWriteError extends Error {
  readonly code: "invalid_input" | "not_found";

  constructor(code: "invalid_input" | "not_found", message: string) {
    super(message);
    this.name = "GraphWriteError";
    this.code = code;
  }
}

export function isGraphWriteError(error: unknown): error is GraphWriteError {
  return error instanceof GraphWriteError;
}

export function assertFolderKind(value: string | undefined): FolderKind | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isFolderKind(value)) {
    throw new GraphWriteError(
      "invalid_input",
      `Invalid folder kind "${value}". Expected folder | playlist | crate | section.`,
    );
  }
  return value;
}
