import { apiFetch } from "@/lib/api/client";

import type {
  SequenceDetail,
  SequenceKind,
  SequenceRecord,
  SequenceReferrer,
  SequenceTrailSeed,
} from "./types";

export type ListSequencesParams = {
  kind?: SequenceKind;
  query?: string;
  complete?: boolean;
  startTrack?: string;
  endTrack?: string;
  limit?: number;
  offset?: number;
};

/** HTTP query for `GET /blocks`. Endpoint filters must use `startTrack` / `endTrack`, not `…Id`. */
export function listSequencesSearchParams(input: ListSequencesParams): string {
  const params = new URLSearchParams();
  if (input.kind) params.set("kind", input.kind);
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.complete === true) params.set("complete", "true");
  if (input.complete === false) params.set("complete", "false");
  if (input.startTrack) params.set("startTrack", input.startTrack);
  if (input.endTrack) params.set("endTrack", input.endTrack);
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.offset != null) params.set("offset", String(input.offset));
  return params.toString();
}

export async function listSequences(input: ListSequencesParams = {}): Promise<{
  ok: true;
  sequences: SequenceRecord[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  const qs = listSequencesSearchParams(input);
  return apiFetch(`/blocks${qs ? `?${qs}` : ""}`);
}

export async function createSequence(body: {
  kind: SequenceKind;
  title: string;
  seed?: { trail: SequenceTrailSeed[] };
}): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch("/blocks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getSequence(
  id: string,
  options: { expand?: boolean; versionId?: string | null } = {},
): Promise<{ ok: true; sequence: SequenceDetail }> {
  const qs = sequenceDetailSearchParams(options);
  return apiFetch(`/blocks/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`);
}

/** HTTP query for `GET /blocks/:id`. */
export function sequenceDetailSearchParams(input: {
  expand?: boolean;
  versionId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.expand) params.set("expand", "1");
  if (input.versionId?.trim()) params.set("version", input.versionId.trim());
  return params.toString();
}

export async function listSequenceReferrers(
  id: string,
): Promise<{ ok: true; referrers: SequenceReferrer[] }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/referrers`);
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
    inBlockId?: string | null;
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
    trackId?: string;
    inTransitionId?: string | null;
    inBlockId?: string | null;
    inBlockVersionId?: string | null;
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

export async function detachSequenceStep(
  id: string,
  stepId: string,
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/detach/${encodeURIComponent(stepId)}`, {
    method: "POST",
  });
}

export async function wrapSequenceSpan(
  id: string,
  body: { fromStepId: string; toStepId: string; title: string; description?: string | null },
): Promise<{ ok: true; sequence: SequenceDetail; block: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/wrap`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createSequenceAlternate(
  id: string,
  body: {
    fromStepId: string;
    toStepId: string;
    label: string;
    altTransitionId?: string | null;
    altBlockId?: string | null;
  },
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/alternates`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSequenceAlternate(
  id: string,
  alternateId: string,
  body: { label: string },
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(
    `/blocks/${encodeURIComponent(id)}/alternates/${encodeURIComponent(alternateId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export async function deleteSequenceAlternate(
  id: string,
  alternateId: string,
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(
    `/blocks/${encodeURIComponent(id)}/alternates/${encodeURIComponent(alternateId)}`,
    { method: "DELETE" },
  );
}

export async function createSequenceVersion(
  id: string,
  body: { name: string; alternateIds: string[] },
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/versions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSequenceVersion(
  id: string,
  versionId: string,
  body: { name?: string; alternateIds?: string[] },
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSequenceVersion(
  id: string,
  versionId: string,
): Promise<{ ok: true; sequence: SequenceDetail }> {
  return apiFetch(`/blocks/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}`, {
    method: "DELETE",
  });
}
