/** Neo4j driver, Cypher helpers, music graph types (stub for M1). */

export {
  TRANSITION_INTENTS,
  TRANSITION_TECHNIQUES,
  isTransitionIntent,
  isTransitionTechnique,
  type TransitionIntent,
  type TransitionTechnique,
} from "./vocabulary";

export function getGraphStatus() {
  return { configured: false as const, store: "neo4j" as const };
}
