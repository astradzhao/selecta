import type { NoteExtractionStatus, NoteProposalStatus } from "@selecta/db";

export type ApiProposalTrackSummary = {
  id: string;
  title: string;
  artists: Array<{ id: string; name: string; nameNormalized: string }>;
  artworkUrl: string | null;
};

export type ApiProposalCandidate = {
  handle: string;
  title: string;
  artists: string[];
  durationMs?: number | null;
  artworkUrl?: string | null;
  provider?: string;
  providerId?: string;
  trackId?: string;
  track?: ApiProposalTrackSummary | null;
};

export type ApiProposalReviewReason = {
  code: string;
  message: string;
};

export type ApiProposal = {
  id: string;
  noteId: string;
  extractionVersion: number;
  status: NoteProposalStatus;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
  sourceFingerprint: string;
  proposalKey: string;
  attemptCount: number;
  error: string | null;
  model: string | null;
  promptVersion: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewState: Record<string, unknown> | null;
  draft: Record<string, unknown> | null;
  resolution: Record<string, unknown> | null;
  policyResult: Record<string, unknown> | null;
  reviewReasons: ApiProposalReviewReason[];
  mentions: Array<Record<string, unknown>>;
  fromTrack: ApiProposalTrackSummary | null;
  toTrack: ApiProposalTrackSummary | null;
  raw: {
    draft: Record<string, unknown> | null;
    resolution: Record<string, unknown> | null;
    policyResult: Record<string, unknown> | null;
  };
};

export type ApiProposalNoteSummary = {
  id: string;
  rawText: string;
  extractionVersion: number;
  extractionStatus: NoteExtractionStatus;
  extractionError: string | null;
  extractionStartedAt: string | null;
  extractionFinishedAt: string | null;
  updatedAt: string;
};

export type ApiTransitionCommit = {
  id: string;
  noteId: string;
  extractionVersion: number;
  proposalKey: string;
  status: string;
  fromTrackId: string | null;
  toTrackId: string | null;
  payload: Record<string, unknown> | null;
  error: string | null;
  committedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiProposalDetail = {
  proposal: ApiProposal;
  note: ApiProposalNoteSummary;
  siblings: ApiProposal[];
  commit: ApiTransitionCommit | null;
};

export type ReviewerEndpointBody =
  | { kind: "track"; trackId: string }
  | {
      kind: "spotify";
      providerId: string;
      title: string;
      artists: string[];
      artworkUrl?: string | null;
      durationMs?: number | null;
    };

export type ApproveProposalBody = {
  expectedUpdatedAt: string;
  from: ReviewerEndpointBody;
  to: ReviewerEndpointBody;
  bidirectional?: boolean;
  transition?: {
    fromBar?: number | null;
    toBar?: number | null;
    barsOverlap?: number | null;
    technique?: string | null;
    intent?: string | null;
    quality?: string | null;
    notes?: string | null;
  };
  reviewNote?: string | null;
};

export type RejectProposalBody = {
  expectedUpdatedAt: string;
  reason?: string | null;
};

export type PatchProposalBody = {
  expectedUpdatedAt: string;
  reviewState: Record<string, unknown>;
};

export type ReopenProposalBody = {
  expectedUpdatedAt: string;
};
