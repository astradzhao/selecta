import type { SubmissionProposal, SubmissionProposalStatus } from "@selecta/db";
import type { TransitionProposalReview, TransitionRecord } from "@selecta/library";

export type TransitionProposalSummary = {
  id: string;
  status: SubmissionProposalStatus;
  proposalKey: string;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
};

/** Endpoint summary: enough for a Library row to render the song, not the full track. */
function serializeEndpoint(endpoint: TransitionRecord["from"]) {
  return {
    id: endpoint.track.id,
    title: endpoint.track.title,
    artists: endpoint.artists,
    subgenres: endpoint.subgenres,
    artworkUrl: endpoint.track.artworkUrl,
    bpm: endpoint.track.bpm,
    musicalKey: endpoint.track.musicalKey,
  };
}

/** API shape for a committed TRANSITION with endpoint summaries. */
export function serializeTransition(
  record: TransitionRecord,
  proposal?: TransitionProposalSummary | TransitionProposalReview | null,
) {
  return {
    id: record.id,
    fromTrack: serializeEndpoint(record.from),
    toTrack: serializeEndpoint(record.to),
    proposalKey: record.edge.proposalKey,
    sourceSubmissionId: record.edge.sourceSubmissionId,
    sourceSubmissionVersion: record.edge.sourceSubmissionVersion,
    sourceProposalId: record.edge.sourceProposalId,
    confidence: record.edge.confidence,
    fromBar: record.edge.fromBar,
    toBar: record.edge.toBar,
    barsOverlap: record.edge.barsOverlap,
    technique: record.edge.technique,
    intent: record.edge.intent,
    quality: record.edge.quality,
    notes: record.edge.notes,
    createdAt: record.edge.createdAt,
    updatedAt: record.edge.updatedAt,
    proposal: proposal ?? null,
  };
}

export function summarizeProposalForTransition(
  proposal: SubmissionProposal,
): TransitionProposalSummary {
  return {
    id: proposal.id,
    status: proposal.status,
    proposalKey: proposal.proposalKey,
    sourceStart: proposal.sourceStart,
    sourceEnd: proposal.sourceEnd,
    sourceText: proposal.sourceText,
  };
}
