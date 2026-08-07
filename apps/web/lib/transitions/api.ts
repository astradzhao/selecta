import { apiFetch } from "@/lib/api/client";

import type { ApiTransition } from "./types";

export type { ApiTransition, ApiTransitionEndpoint, ApiTransitionProposalSummary } from "./types";

export async function listTransitions(
  input: {
    query?: string;
    fromTrackId?: string;
    toTrackId?: string;
    technique?: string;
    intent?: string;
    quality?: string;
    sourceNoteId?: string;
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
  if (input.sourceNoteId?.trim()) params.set("sourceNoteId", input.sourceNoteId.trim());
  if (input.source) params.set("source", input.source);
  if (input.sort) params.set("sort", input.sort);
  if (input.order) params.set("order", input.order);
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  if (input.includeReview === false) params.set("includeReview", "0");
  const qs = params.toString();
  return apiFetch(`/transitions${qs ? `?${qs}` : ""}`);
}
