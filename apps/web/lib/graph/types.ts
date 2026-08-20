import type { ApiTrack } from "@/lib/tracks/types";

/** Transition edge fields on neighborhood neighbors (DJ-40 / DJ-73). */
export type ApiTransitionEdge = {
  id: string | null;
  proposalKey: string | null;
  sourceSubmissionId: string | null;
  sourceSubmissionVersion: number | null;
  sourceProposalId: string | null;
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
  /** Outbound edges to this destination, best-first (`[0]` is the default selection). */
  transitions: ApiTransitionEdge[];
};

export type ApiNeighborhoodCurrent = Omit<
  ApiTrack,
  "created" | "hasOutboundTransitions" | "hasInboundTransitions"
>;
