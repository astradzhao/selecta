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
  type TrackExternalIds,
  type CreateTrackInput,
  type CreateTrackResult,
  type GraphNamedNode,
  type GraphFolderNode,
  type GraphTrackNode,
} from "./types";

export { mergeArtist, mergeGenre, mergeSubgenre, mergeFolder, createTrack } from "./writes";

export {
  listTracks,
  getTrackById,
  type ListTracksInput,
  type TrackSummary,
  type TrackDetail,
} from "./tracks";

export { closeDriver, getDriver, isNeo4jConfigured, type GraphStatus } from "./client";

export { getGraphStatus, readCypher, runCypher, writeCypher, type CypherParams } from "./cypher";

export {
  GRAPH_SCHEMA_STATEMENTS,
  ensureConstraints,
  type EnsureConstraintsResult,
} from "./constraints";
