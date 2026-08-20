import { apiFetch } from "@/lib/api/client";

import type { ApiTransition } from "./types";

export type { ApiTransition, ApiTransitionEndpoint, ApiTransitionProposalSummary } from "./types";

export type UpdateTransitionBody = {
  fromBar?: number | null;
  toBar?: number | null;
  barsOverlap?: number | null;
  technique?: string | null;
  intent?: string | null;
  quality?: string | null;
  notes?: string | null;
};

export type CreateTransitionBody = {
  fromTrackId: string;
  toTrackId: string;
  fromBar?: number | null;
  toBar?: number | null;
  barsOverlap?: number | null;
  technique?: string | null;
  intent?: string | null;
  quality?: string | null;
  notes?: string | null;
};

export async function listTransitions(
  input: {
    query?: string;
    fromTrackId?: string;
    toTrackId?: string;
    technique?: string;
    intent?: string;
    quality?: string;
    sourceSubmissionId?: string;
    source?: "manual" | "ai";
    sort?: "createdAt" | "updatedAt";
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
    includeReview?: boolean;
  } = {},
): Promise<{
  ok: true;
  transitions: ApiTransition[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.fromTrackId?.trim()) params.set("fromTrackId", input.fromTrackId.trim());
  if (input.toTrackId?.trim()) params.set("toTrackId", input.toTrackId.trim());
  if (input.technique?.trim()) params.set("technique", input.technique.trim());
  if (input.intent?.trim()) params.set("intent", input.intent.trim());
  if (input.quality?.trim()) params.set("quality", input.quality.trim());
  if (input.sourceSubmissionId?.trim())
    params.set("sourceSubmissionId", input.sourceSubmissionId.trim());
  if (input.source) params.set("source", input.source);
  if (input.sort) params.set("sort", input.sort);
  if (input.order) params.set("order", input.order);
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  if (input.includeReview === false) params.set("includeReview", "0");
  const qs = params.toString();
  return apiFetch(`/transitions${qs ? `?${qs}` : ""}`);
}

export async function getTransition(id: string): Promise<{ ok: true; transition: ApiTransition }> {
  return apiFetch(`/transitions/${encodeURIComponent(id)}`);
}

export async function createTransition(
  body: CreateTransitionBody,
): Promise<{ ok: true; transition: ApiTransition }> {
  return apiFetch("/transitions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateTransition(
  id: string,
  body: UpdateTransitionBody,
): Promise<{ ok: true; transition: ApiTransition }> {
  return apiFetch(`/transitions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteTransition(
  id: string,
): Promise<{ ok: true; id: string; deleted: boolean }> {
  return apiFetch(`/transitions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
