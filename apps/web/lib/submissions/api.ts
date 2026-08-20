import { apiFetch } from "@/lib/api/client";

import type { ApiSubmission, ApiSubmissionTrackLink, SubmissionExtractionStatus } from "./types";

export type {
  ApiSubmission,
  ApiSubmissionProposalCounts,
  ApiSubmissionProposalLink,
  ApiSubmissionTrackLink,
  SubmissionExtractionStatus,
} from "./types";

export async function listSubmissions(
  input: {
    query?: string;
    status?: SubmissionExtractionStatus;
    needsReview?: boolean;
    createdAfter?: string;
    createdBefore?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  ok: true;
  submissions: ApiSubmission[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.status) params.set("status", input.status);
  if (input.needsReview === true) params.set("needsReview", "true");
  if (input.needsReview === false) params.set("needsReview", "false");
  if (input.createdAfter) params.set("createdAfter", input.createdAfter);
  if (input.createdBefore) params.set("createdBefore", input.createdBefore);
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  const qs = params.toString();
  return apiFetch(`/submissions${qs ? `?${qs}` : ""}`);
}

export async function getSubmission(id: string): Promise<{ ok: true; submission: ApiSubmission }> {
  return apiFetch(`/submissions/${encodeURIComponent(id)}`);
}

export async function createSubmission(body: {
  rawText: string;
}): Promise<{ ok: true; submission: ApiSubmission }> {
  return apiFetch("/submissions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Retry extraction for the current submission version. */
export async function extractSubmission(
  id: string,
): Promise<{ ok: true; submission: ApiSubmission }> {
  return apiFetch(`/submissions/${encodeURIComponent(id)}/extract`, {
    method: "POST",
  });
}

export async function addSubmissionTrackLink(
  submissionId: string,
  body: { trackId: string; role?: string | null },
): Promise<{
  ok: true;
  trackLink: ApiSubmissionTrackLink;
  trackLinks: ApiSubmissionTrackLink[];
  submission?: ApiSubmission;
}> {
  return apiFetch(`/submissions/${encodeURIComponent(submissionId)}/tracks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function removeSubmissionTrackLink(
  submissionId: string,
  trackId: string,
): Promise<{ ok: true; trackLinks: ApiSubmissionTrackLink[]; submission?: ApiSubmission }> {
  return apiFetch(
    `/submissions/${encodeURIComponent(submissionId)}/tracks/${encodeURIComponent(trackId)}`,
    {
      method: "DELETE",
    },
  );
}
