import type { ApiTransitionEdge } from "@/lib/graph/types";
import { formatGraphLabel } from "@/lib/graph/viz";

export function edgeKey(edge: ApiTransitionEdge, fallback: string): string {
  return edge.id ?? edge.proposalKey ?? fallback;
}

export function provenanceLabel(edge: ApiTransitionEdge): {
  kind: "manual" | "ai";
  submissionId: string | null;
} {
  const isAi = Boolean(edge.proposalKey || edge.sourceSubmissionId);
  return { kind: isAi ? "ai" : "manual", submissionId: edge.sourceSubmissionId };
}

export { formatGraphLabel };
