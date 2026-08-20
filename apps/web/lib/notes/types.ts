import type { NoteExtractionStatus } from "@selecta/db";

import type { ApiNamedNode } from "@/lib/tracks/types";

export type { NoteExtractionStatus };

export type ApiNoteTrackLink = {
  id: string;
  trackId: string;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  track: {
    id: string;
    title: string;
    artists: ApiNamedNode[];
    artworkUrl: string | null;
  } | null;
};

export type ApiNoteProposalLink = {
  id: string;
  proposalKey: string;
  status: string;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
};

export type ApiNoteProposalCounts = {
  committed: number;
  needsReview: number;
  failed: number;
  total: number;
};

export type ApiNote = {
  id: string;
  rawText: string;
  extractionStatus: NoteExtractionStatus;
  extractionVersion: number;
  extractionError: string | null;
  extractionConfidence: number | null;
  extractionStartedAt: string | null;
  extractionFinishedAt: string | null;
  extraction: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  rawResponse: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  trackLinks?: ApiNoteTrackLink[];
  proposalCounts?: ApiNoteProposalCounts;
  proposals?: ApiNoteProposalLink[];
};
