import { apiFetch } from "@/lib/api/client";
import type { ApiTransition } from "@/lib/transitions/types";

import type {
  ApiProposal,
  ApiProposalDetail,
  ApproveProposalBody,
  PatchProposalBody,
  RejectProposalBody,
  ReopenProposalBody,
} from "./types";

export type {
  ApiProposal,
  ApiProposalCandidate,
  ApiProposalDetail,
  ApiProposalNoteSummary,
  ApiProposalReviewReason,
  ApiProposalTrackSummary,
  ApiTransitionCommit,
  ApproveProposalBody,
  PatchProposalBody,
  RejectProposalBody,
  ReopenProposalBody,
  ReviewerEndpointBody,
} from "./types";

export async function listProposals(
  input: {
    status?: string;
    noteId?: string;
    q?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  ok: true;
  proposals: ApiProposal[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (input.status?.trim()) params.set("status", input.status.trim());
  if (input.noteId?.trim()) params.set("noteId", input.noteId.trim());
  if (input.q?.trim()) params.set("q", input.q.trim());
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  const qs = params.toString();
  return apiFetch(`/proposals${qs ? `?${qs}` : ""}`);
}

export async function getProposal(id: string): Promise<{
  ok: true;
  proposal: ApiProposalDetail["proposal"];
  note: ApiProposalDetail["note"];
  siblings: ApiProposalDetail["siblings"];
  commit: ApiProposalDetail["commit"];
}> {
  return apiFetch(`/proposals/${encodeURIComponent(id)}`);
}

export async function listNoteProposals(
  noteId: string,
  input: { version?: number } = {},
): Promise<{
  ok: true;
  proposals: ApiProposal[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (input.version != null) params.set("version", String(input.version));
  const qs = params.toString();
  return apiFetch(`/notes/${encodeURIComponent(noteId)}/proposals${qs ? `?${qs}` : ""}`);
}

export async function approveProposal(
  id: string,
  body: ApproveProposalBody,
): Promise<{
  ok: true;
  alreadyCommitted: boolean;
  proposal: ApiProposal;
  transition: ApiTransition | null;
  reverseTransition: ApiTransition | null;
}> {
  return apiFetch(`/proposals/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function rejectProposal(
  id: string,
  body: RejectProposalBody,
): Promise<{ ok: true; proposal: ApiProposal }> {
  return apiFetch(`/proposals/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resolveProposal(id: string): Promise<{
  ok: true;
  committed: boolean;
  proposal: ApiProposal;
  transition: ApiTransition | null;
  reverseTransition: ApiTransition | null;
}> {
  return apiFetch(`/proposals/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
  });
}

export async function patchProposal(
  id: string,
  body: PatchProposalBody,
): Promise<{ ok: true; proposal: ApiProposal }> {
  return apiFetch(`/proposals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function reopenProposal(
  id: string,
  body: ReopenProposalBody,
): Promise<{ ok: true; proposal: ApiProposal }> {
  return apiFetch(`/proposals/${encodeURIComponent(id)}/reopen`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
