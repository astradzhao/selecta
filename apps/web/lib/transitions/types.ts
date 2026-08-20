import type { NoteProposalStatus } from "@selecta/db";

import type { ApiNamedNode } from "@/lib/tracks/types";

export type ApiTransitionProposalSummary = {
  id: string;
  status: NoteProposalStatus;
  proposalKey: string;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
};

export type ApiTransitionEndpoint = {
  id: string;
  title: string;
  artists: ApiNamedNode[];
};

export type ApiTransition = {
  id: string;
  fromTrack: ApiTransitionEndpoint;
  toTrack: ApiTransitionEndpoint;
  proposalKey: string | null;
  sourceNoteId: string | null;
  sourceNoteVersion: number | null;
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
