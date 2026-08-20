import type { SubmissionExtractionStatus } from "@selecta/db";

import type { ApiNamedNode } from "@/lib/tracks/types";

export type { SubmissionExtractionStatus };

export type ApiSubmissionTrackLink = {
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

export type ApiSubmissionProposalLink = {
  id: string;
  proposalKey: string;
  status: string;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
};

export type ApiSubmissionProposalCounts = {
  committed: number;
  needsReview: number;
  failed: number;
  total: number;
};

export type ApiSubmission = {
  id: string;
  rawText: string;
  extractionStatus: SubmissionExtractionStatus;
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
  trackLinks?: ApiSubmissionTrackLink[];
  proposalCounts?: ApiSubmissionProposalCounts;
  proposals?: ApiSubmissionProposalLink[];
};
