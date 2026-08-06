import {
  FOLDER_KINDS,
  NODE_LABELS,
  REL_TYPES,
  TRANSITION_INTENTS,
  TRANSITION_TECHNIQUES,
} from "./schema";

/**
 * Compact, serializable Neo4j schema for agent system prompts.
 * The model may read this; it must not execute Cypher.
 */
export const AGENT_SAFE_GRAPH_SCHEMA = {
  version: "v1",
  nodeLabels: Object.values(NODE_LABELS),
  relationships: [
    { type: REL_TYPES.BY, from: NODE_LABELS.Artist, to: NODE_LABELS.Track },
    { type: REL_TYPES.IN_GENRE, from: NODE_LABELS.Track, to: NODE_LABELS.Genre },
    { type: REL_TYPES.IN_SUBGENRE, from: NODE_LABELS.Track, to: NODE_LABELS.Subgenre },
    { type: REL_TYPES.IN_FOLDER, from: NODE_LABELS.Track, to: NODE_LABELS.Folder },
    { type: REL_TYPES.TRANSITION, from: NODE_LABELS.Track, to: NODE_LABELS.Track },
    { type: REL_TYPES.HAS_CUE, from: NODE_LABELS.Track, to: NODE_LABELS.Cue },
  ],
  trackRequired: ["title", "artists (≥1)"],
  trackOptional: [
    "bpm",
    "musicalKey",
    "durationSec",
    "energy",
    "artworkUrl",
    "releaseDate",
    "externalIds",
    "genres",
    "subgenres",
    "folders",
  ],
  transitionProperties: [
    "id",
    "fromBar",
    "toBar",
    "barsOverlap",
    "technique",
    "intent",
    "quality",
    "notes",
    "sourceNoteId",
    "sourceNoteVersion",
    "sourceProposalId",
    "proposalKey",
    "confidence",
    "createdAt",
    "updatedAt",
  ],
  transitionIntents: TRANSITION_INTENTS,
  transitionTechniques: TRANSITION_TECHNIQUES,
  transitionQualities: ["great", "ok", "risky"] as const,
  folderKinds: FOLDER_KINDS,
  rules: [
    "Never invent Track ids — only use ids returned by search tools.",
    "Do not emit Cypher. Use tools for library/catalog search only.",
    "Notes and users live in Postgres, not Neo4j.",
    "Provider genres may be empty on Spotify imports; do not invent genres.",
  ],
} as const;

export type AgentSafeGraphSchema = typeof AGENT_SAFE_GRAPH_SCHEMA;

/** Human-readable block for system prompts. */
export function formatAgentSafeGraphSchema(
  schema: AgentSafeGraphSchema = AGENT_SAFE_GRAPH_SCHEMA,
): string {
  return [
    `Graph schema version: ${schema.version}`,
    "",
    `Node labels: ${schema.nodeLabels.join(", ")}`,
    "Relationships:",
    ...schema.relationships.map((rel) => `- (:${rel.from})-[:${rel.type}]->(:${rel.to})`),
    "",
    `Track required: ${schema.trackRequired.join(", ")}`,
    `Track optional: ${schema.trackOptional.join(", ")}`,
    `TRANSITION properties: ${schema.transitionProperties.join(", ")}`,
    `Intents: ${schema.transitionIntents.join(", ")}`,
    `Techniques: ${schema.transitionTechniques.join(", ")}`,
    `Qualities: ${schema.transitionQualities.join(", ")}`,
    "",
    "Rules:",
    ...schema.rules.map((rule) => `- ${rule}`),
  ].join("\n");
}
