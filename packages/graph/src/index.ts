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
  commitTransitionProposal,
  commitTransitionProposals,
  type CommitTransitionInput,
  type CommitTransitionResult,
} from "./writes";

export {
  AGENT_SAFE_GRAPH_SCHEMA,
  formatAgentSafeGraphSchema,
  type AgentSafeGraphSchema,
} from "./agent-schema";

export {
  listTracks,
  getTrackById,
  getTrackByExternalId,
  getLibraryStats,
  type ListTracksInput,
  type TrackSummary,
  type TrackDetail,
  type LibraryStats,
} from "./tracks";

export {
  getTrackNeighborhood,
  rankNeighborhoodNeighbors,
  compareNeighborhoodNeighbors,
  transitionQualityRank,
  asTransitionEdge,
  type TransitionEdgeSummary,
  type NeighborhoodNeighbor,
  type TrackNeighborhood,
} from "./neighborhood";

export { closeDriver, getDriver, isNeo4jConfigured, type GraphStatus } from "./client";

export { getGraphStatus, readCypher, runCypher, writeCypher, type CypherParams } from "./cypher";

export {
  GRAPH_SCHEMA_STATEMENTS,
  ensureConstraints,
  type EnsureConstraintsResult,
} from "./constraints";
