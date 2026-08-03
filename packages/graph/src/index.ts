/** Neo4j driver, Cypher helpers, schema constraints, and music graph types. */

export {
  TRANSITION_INTENTS,
  TRANSITION_TECHNIQUES,
  FOLDER_KINDS,
  NODE_LABELS,
  REL_TYPES,
  isTransitionIntent,
  isTransitionTechnique,
  isFolderKind,
  type TransitionIntent,
  type TransitionTechnique,
  type FolderKind,
  type NodeLabel,
  type RelType,
} from "./schema";

export { normalizeName } from "./normalize";

export {
  GraphWriteError,
  isGraphWriteError,
  assertFolderKind,
  type NamedRef,
  type FolderRef,
  type SongExternalIds,
  type CreateSongInput,
  type CreateSongResult,
  type GraphNamedNode,
  type GraphFolderNode,
  type GraphSongNode,
} from "./types";

export { mergeArtist, mergeGenre, mergeSubgenre, mergeFolder, createSong } from "./writes";

export {
  listSongs,
  getSongById,
  type ListSongsInput,
  type SongSummary,
  type SongDetail,
} from "./songs";

export { closeDriver, getDriver, isNeo4jConfigured, type GraphStatus } from "./client";

export { getGraphStatus, readCypher, runCypher, writeCypher, type CypherParams } from "./cypher";

export {
  GRAPH_SCHEMA_STATEMENTS,
  ensureConstraints,
  type EnsureConstraintsResult,
} from "./constraints";
