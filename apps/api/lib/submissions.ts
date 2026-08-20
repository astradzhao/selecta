import { type Submission, type SubmissionTrackLink } from "@selecta/db";
import { type TrackSummary } from "@selecta/library";
import {
  listSubmissionTrackLinksWithTracks,
  type SubmissionListItem,
  type SubmissionProposalLink,
} from "@selecta/submissions";

export type SerializedTrackSummary = {
  id: string;
  title: string;
  artists: Array<{ id: string; name: string; nameNormalized: string }>;
  artworkUrl: string | null;
};

export type SerializedSubmissionTrackLink = {
  id: string;
  trackId: string;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  track: SerializedTrackSummary | null;
};

export type SerializedProposalLink = {
  id: string;
  proposalKey: string;
  status: SubmissionProposalLink["status"];
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
};

export type SerializedSubmission = {
  id: string;
  rawText: string;
  extractionStatus: Submission["extractionStatus"];
  extractionVersion: number;
  extractionError: string | null;
  extractionConfidence: number | null;
  extractionStartedAt: string | null;
  extractionFinishedAt: string | null;
  extraction: Submission["extraction"];
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  rawResponse: Submission["rawResponse"];
  createdAt: string;
  updatedAt: string;
  trackLinks?: SerializedSubmissionTrackLink[];
  proposalCounts?: {
    committed: number;
    needsReview: number;
    failed: number;
    total: number;
  };
  proposals?: SerializedProposalLink[];
};

function serializeTrackSummary(detail: TrackSummary): SerializedTrackSummary {
  return {
    id: detail.track.id,
    title: detail.track.title,
    artists: detail.artists,
    artworkUrl: detail.track.artworkUrl,
  };
}

export function serializeSubmission(
  submission: Submission,
  trackLinks?: SerializedSubmissionTrackLink[],
  listItem?: Pick<SubmissionListItem, "proposalCounts" | "proposals">,
): SerializedSubmission {
  return {
    id: submission.id,
    rawText: submission.rawText,
    extractionStatus: submission.extractionStatus,
    extractionVersion: submission.extractionVersion,
    extractionError: submission.extractionError,
    extractionConfidence: submission.extractionConfidence,
    extractionStartedAt: submission.extractionStartedAt?.toISOString() ?? null,
    extractionFinishedAt: submission.extractionFinishedAt?.toISOString() ?? null,
    extraction: submission.extraction,
    provider: submission.provider,
    model: submission.model,
    promptVersion: submission.promptVersion,
    rawResponse: submission.rawResponse,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    ...(trackLinks !== undefined ? { trackLinks } : {}),
    ...(listItem
      ? {
          proposalCounts: listItem.proposalCounts,
          proposals: listItem.proposals,
        }
      : {}),
  };
}

export function serializeSubmissionTrackLink(
  link: SubmissionTrackLink,
  track: SerializedTrackSummary | null,
): SerializedSubmissionTrackLink {
  return {
    id: link.id,
    trackId: link.trackId,
    role: link.role,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    track,
  };
}

/** Resolve manual links with a tracks LEFT JOIN (+ batch summary hydrate). */
export async function loadSerializedTrackLinks(
  submissionId: string,
): Promise<SerializedSubmissionTrackLink[]> {
  try {
    const rows = await listSubmissionTrackLinksWithTracks(submissionId);
    return rows.map(({ link, track }) =>
      serializeSubmissionTrackLink(link, track ? serializeTrackSummary(track) : null),
    );
  } catch (error) {
    console.error(`failed to resolve tracks for submission ${submissionId}`, error);
    return [];
  }
}
