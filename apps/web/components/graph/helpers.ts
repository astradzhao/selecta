import type { ApiTransitionEdge } from "@/lib/graph/types";
import { formatGraphLabel } from "@/lib/graph/viz";

export function edgeKey(edge: ApiTransitionEdge, fallback: string): string {
  return edge.id ?? edge.proposalKey ?? fallback;
}

export function provenanceLabel(edge: ApiTransitionEdge): {
  kind: "manual" | "ai";
  noteId: string | null;
} {
  const isAi = Boolean(edge.proposalKey || edge.sourceNoteId);
  return { kind: isAi ? "ai" : "manual", noteId: edge.sourceNoteId };
}

export { formatGraphLabel };
