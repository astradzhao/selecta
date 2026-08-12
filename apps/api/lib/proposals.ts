import {
  getTrackSummariesByIds,
  type NoteProposal,
  type NoteTransitionCommit,
  type ProposalDetail,
  type TrackSummary,
} from "@selecta/db";
import { parseCandidateHandle } from "@selecta/mix-notes";

export type SerializedTrackSummary = {
  id: string;
  title: string;
  artists: Array<{ id: string; name: string; nameNormalized: string }>;
  artworkUrl: string | null;
};

export type SerializedCandidate = {
  handle: string;
  title: string;
  artists: string[];
  durationMs?: number | null;
  artworkUrl?: string | null;
  provider?: string;
  providerId?: string;
  trackId?: string;
  track?: SerializedTrackSummary | null;
};

export type SerializedProposal = {
  id: string;
  noteId: string;
  extractionVersion: number;
  status: NoteProposal["status"];
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
  reviewReasons: Array<{ code: string; message: string }>;
  mentions: Array<Record<string, unknown>>;
  fromTrack: SerializedTrackSummary | null;
  toTrack: SerializedTrackSummary | null;
  raw: {
    draft: Record<string, unknown> | null;
    resolution: Record<string, unknown> | null;
    policyResult: Record<string, unknown> | null;
  };
};

export type SerializedTransitionCommit = {
  id: string;
  noteId: string;
  extractionVersion: number;
  proposalKey: string;
  status: NoteTransitionCommit["status"];
  fromTrackId: string | null;
  toTrackId: string | null;
  payload: Record<string, unknown> | null;
  error: string | null;
  committedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedProposalDetail = {
  proposal: SerializedProposal;
  note: {
    id: string;
    rawText: string;
    extractionVersion: number;
    extractionStatus: ProposalDetail["note"]["extractionStatus"];
    extractionError: string | null;
    extractionStartedAt: string | null;
    extractionFinishedAt: string | null;
    updatedAt: string;
  };
  siblings: SerializedProposal[];
  commit: SerializedTransitionCommit | null;
};

function serializeTrackSummary(detail: TrackSummary): SerializedTrackSummary {
  return {
    id: detail.track.id,
    title: detail.track.title,
    artists: detail.artists,
    artworkUrl: detail.track.artworkUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readReviewReasons(
  policyResult: Record<string, unknown> | null,
): Array<{ code: string; message: string }> {
  if (!policyResult) {
    return [];
  }
  const direct = policyResult.reviewReasons;
  if (Array.isArray(direct)) {
    return direct.filter(isRecord).map((reason) => ({
      code: typeof reason.code === "string" ? reason.code : "unknown",
      message: typeof reason.message === "string" ? reason.message : "",
    }));
  }
  const reasons = policyResult.reasons;
  if (Array.isArray(reasons)) {
    return reasons
      .filter(isRecord)
      .filter((reason) => reason.code !== "ok")
      .map((reason) => ({
        code: typeof reason.code === "string" ? reason.code : "unknown",
        message: typeof reason.message === "string" ? reason.message : "",
      }));
  }
  return [];
}

function collectTrackIds(
  proposal: NoteProposal,
  resolution: Record<string, unknown> | null,
): string[] {
  const ids = new Set<string>();
  const applied = isRecord(proposal.policyResult?.applied) ? proposal.policyResult.applied : null;
  if (applied) {
    if (typeof applied.fromTrackId === "string") ids.add(applied.fromTrackId);
    if (typeof applied.toTrackId === "string") ids.add(applied.toTrackId);
  }

  const candidates = isRecord(resolution?.candidates) ? resolution.candidates : null;
  if (candidates) {
    for (const value of Object.values(candidates)) {
      if (!Array.isArray(value)) continue;
      for (const candidate of value) {
        if (!isRecord(candidate)) continue;
        if (typeof candidate.trackId === "string") {
          ids.add(candidate.trackId);
        }
        if (typeof candidate.handle === "string") {
          const parsed = parseCandidateHandle(candidate.handle);
          if (parsed?.kind === "graph") {
            ids.add(parsed.id);
          }
        }
      }
    }
  }

  return [...ids];
}

function hydrateCandidates(
  candidates: unknown[],
  summaries: Map<string, TrackSummary>,
): SerializedCandidate[] {
  return candidates.filter(isRecord).map((candidate) => {
    let trackId = typeof candidate.trackId === "string" ? candidate.trackId : null;
    if (!trackId && typeof candidate.handle === "string") {
      const parsed = parseCandidateHandle(candidate.handle);
      if (parsed?.kind === "graph") {
        trackId = parsed.id;
      }
    }
    const track = trackId ? (summaries.get(trackId) ?? null) : null;
    return {
      handle: typeof candidate.handle === "string" ? candidate.handle : "",
      title: typeof candidate.title === "string" ? candidate.title : "",
      artists: Array.isArray(candidate.artists)
        ? candidate.artists.map((artist) => String(artist))
        : [],
      durationMs:
        typeof candidate.durationMs === "number" && Number.isFinite(candidate.durationMs)
          ? candidate.durationMs
          : null,
      artworkUrl: typeof candidate.artworkUrl === "string" ? candidate.artworkUrl : null,
      provider: typeof candidate.provider === "string" ? candidate.provider : undefined,
      providerId: typeof candidate.providerId === "string" ? candidate.providerId : undefined,
      trackId: trackId ?? undefined,
      track: track ? serializeTrackSummary(track) : null,
    };
  });
}

function extractMentions(
  draft: Record<string, unknown> | null,
  resolution: Record<string, unknown> | null,
  candidatesByMention: Record<string, SerializedCandidate[]>,
): Array<Record<string, unknown>> {
  const plan = isRecord(resolution?.plan) ? resolution.plan : null;
  const planMentions = Array.isArray(plan?.mentions) ? plan.mentions : null;
  const draftMentions = Array.isArray(draft?.mentions) ? draft.mentions : null;
  const source = planMentions ?? draftMentions ?? [];

  return source.filter(isRecord).map((mention) => {
    const mentionId = typeof mention.mentionId === "string" ? mention.mentionId : "";
    return {
      ...mention,
      candidates: candidatesByMention[mentionId] ?? [],
    };
  });
}

export async function serializeProposal(proposal: NoteProposal): Promise<SerializedProposal> {
  const draft = proposal.draft;
  const resolution = proposal.resolution;
  const policyResult = proposal.policyResult;

  const trackIds = collectTrackIds(proposal, resolution);
  const summaries = trackIds.length > 0 ? await getTrackSummariesByIds(trackIds) : new Map();

  const resolutionCandidates = isRecord(resolution?.candidates) ? resolution.candidates : {};
  const candidatesByMention: Record<string, SerializedCandidate[]> = {};
  for (const [mentionId, value] of Object.entries(resolutionCandidates)) {
    candidatesByMention[mentionId] = hydrateCandidates(
      Array.isArray(value) ? value : [],
      summaries,
    );
  }

  const applied = isRecord(policyResult?.applied) ? policyResult.applied : null;
  const fromTrackId =
    typeof applied?.fromTrackId === "string"
      ? applied.fromTrackId
      : proposal.status === "committed" && typeof applied?.fromTrackId === "string"
        ? applied.fromTrackId
        : null;
  const toTrackId = typeof applied?.toTrackId === "string" ? applied.toTrackId : null;

  const fromSummary = fromTrackId ? (summaries.get(fromTrackId) ?? null) : null;
  const toSummary = toTrackId ? (summaries.get(toTrackId) ?? null) : null;

  return {
    id: proposal.id,
    noteId: proposal.noteId,
    extractionVersion: proposal.extractionVersion,
    status: proposal.status,
    sourceStart: proposal.sourceStart,
    sourceEnd: proposal.sourceEnd,
    sourceText: proposal.sourceText,
    sourceFingerprint: proposal.sourceFingerprint,
    proposalKey: proposal.proposalKey,
    attemptCount: proposal.attemptCount,
    error: proposal.error,
    model: proposal.model,
    promptVersion: proposal.promptVersion,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
    reviewedAt: proposal.reviewedAt?.toISOString() ?? null,
    reviewedBy: proposal.reviewedBy,
    reviewNote: proposal.reviewNote,
    reviewState: proposal.reviewState ?? null,
    draft,
    resolution,
    policyResult,
    reviewReasons: readReviewReasons(policyResult),
    mentions: extractMentions(draft, resolution, candidatesByMention),
    fromTrack: fromSummary ? serializeTrackSummary(fromSummary) : null,
    toTrack: toSummary ? serializeTrackSummary(toSummary) : null,
    raw: {
      draft,
      resolution,
      policyResult,
    },
  };
}

function serializeCommit(commit: NoteTransitionCommit): SerializedTransitionCommit {
  return {
    id: commit.id,
    noteId: commit.noteId,
    extractionVersion: commit.extractionVersion,
    proposalKey: commit.proposalKey,
    status: commit.status,
    fromTrackId: commit.fromTrackId,
    toTrackId: commit.toTrackId,
    payload: commit.payload ?? null,
    error: commit.error,
    committedAt: commit.committedAt?.toISOString() ?? null,
    createdAt: commit.createdAt.toISOString(),
    updatedAt: commit.updatedAt.toISOString(),
  };
}

export async function serializeProposalDetail(
  detail: ProposalDetail,
): Promise<SerializedProposalDetail> {
  const proposal = await serializeProposal(detail.proposal);
  const siblings = await Promise.all(detail.siblings.map((row) => serializeProposal(row)));

  return {
    proposal,
    note: {
      id: detail.note.id,
      rawText: detail.note.rawText,
      extractionVersion: detail.note.extractionVersion,
      extractionStatus: detail.note.extractionStatus,
      extractionError: detail.note.extractionError,
      extractionStartedAt: detail.note.extractionStartedAt?.toISOString() ?? null,
      extractionFinishedAt: detail.note.extractionFinishedAt?.toISOString() ?? null,
      updatedAt: detail.note.updatedAt.toISOString(),
    },
    siblings,
    commit: detail.commit ? serializeCommit(detail.commit) : null,
  };
}

export async function serializeProposals(proposals: NoteProposal[]): Promise<SerializedProposal[]> {
  return Promise.all(proposals.map((proposal) => serializeProposal(proposal)));
}
