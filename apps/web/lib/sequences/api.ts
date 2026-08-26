import { apiFetch } from "@/lib/api/client";

import type { SequenceDetail, SequenceKind, SequenceRecord } from "./types";

export async function listSequences(input: {
  kind?: SequenceKind;
  query?: string;
  complete?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  ok: true;
  sequences: SequenceRecord[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (input.kind) params.set("kind", input.kind);
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.complete === true) params.set("complete", "true");
  if (input.complete === false) params.set("complete", "false");
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  const qs = params.toString();
  return apiFetch(`/blocks${qs ? `?${qs}` : ""}`);
}

export async function createSequence(body: {
  kind: SequenceKind;
  title: string;
}): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch("/blocks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getSequence(id: string): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}`);
}

export async function updateSequence(
  id: string,
  body: { title?: string; expectedUpdatedAt: string },
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSequence(id: string): Promise<{ ok: true; id: string; deleted: true }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function addSequenceStep(
  id: string,
  body: {
    trackId: string;
    position?: number | "append";
    inTransitionId?: string | null;
  },
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/steps`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSequenceStep(
  id: string,
  stepId: string,
  body: {
    inTransitionId?: string | null;
    inBlockId?: string | null;
    isSeam?: boolean;
    note?: string | null;
  },
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/steps/${encodeURIComponent(stepId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSequenceStep(
  id: string,
  stepId: string,
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/steps/${encodeURIComponent(stepId)}`, {
    method: "DELETE",
  });
}

export async function reorderSequence(
  id: string,
  body: { stepIds: string[]; expectedUpdatedAt: string },
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/reorder`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
