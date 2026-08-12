import { apiFetch } from "@/lib/api/client";

export type VocabNamedItem = {
  id: string;
  name: string;
  nameNormalized: string;
};

export type VocabFolderItem = VocabNamedItem & {
  kind: "folder" | "playlist" | null;
};

export type VocabType = "genres" | "subgenres" | "folders";

export async function listVocab(
  type: "genres" | "subgenres",
  input?: { query?: string; limit?: number },
): Promise<{ ok: true; type: typeof type; items: VocabNamedItem[] }>;
export async function listVocab(
  type: "folders",
  input?: { query?: string; limit?: number },
): Promise<{ ok: true; type: "folders"; items: VocabFolderItem[] }>;
export async function listVocab(
  type: VocabType,
  input: { query?: string; limit?: number } = {},
): Promise<{ ok: true; type: VocabType; items: VocabNamedItem[] | VocabFolderItem[] }> {
  const params = new URLSearchParams();
  params.set("type", type);
  if (input.query?.trim()) params.set("q", input.query.trim());
  if (input.limit != null) params.set("limit", String(input.limit));
  return apiFetch(`/vocab?${params.toString()}`);
}
