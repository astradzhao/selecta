import type { SubmissionProposalStatus } from "@selecta/db";

import type { ApiNamedNode } from "@/lib/tracks/types";

export type ApiTransitionProposalSummary = {
  id: string;
  status: SubmissionProposalStatus;
  proposalKey: string;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
};

export type ApiTransitionEndpoint = {
  id: string;
  title: string;
  artists: ApiNamedNode[];
  subgenres: ApiNamedNode[];
  artworkUrl: string | null;
  bpm: number | null;
  musicalKey: string | null;
};

export type ApiTransition = {
  id: string;
  fromTrack: ApiTransitionEndpoint;
  toTrack: ApiTransitionEndpoint;
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
  createdAt: string;
  updatedAt: string;
  proposal: ApiTransitionProposalSummary | null;
};
