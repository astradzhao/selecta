import { libraryAddHref } from "@/lib/library/add-routes";

export const SETS_VIEWS = ["sets", "blocks"] as const;

export type SetsView = (typeof SETS_VIEWS)[number];

export function matchSetsView(raw: string | undefined | null): SetsView | null {
  return SETS_VIEWS.includes(raw as SetsView) ? (raw as SetsView) : null;
}

export function parseSetsView(raw: string | undefined | null): SetsView {
  return matchSetsView(raw) ?? "sets";
}

export function setsViewHref(view: SetsView): string {
  return view === "sets" ? "/sets" : "/sets?view=blocks";
}

export function sequenceWorkspaceHref(kind: "set" | "block", id: string): string {
  return kind === "block" ? `/blocks/${encodeURIComponent(id)}` : `/sets/${encodeURIComponent(id)}`;
}

export function graphSetHref(
  id: string,
  options: { versionId?: string | null; stepId?: string | null } = {},
): string {
  const params = new URLSearchParams();
  params.set("set", id);
  if (options.versionId?.trim()) params.set("version", options.versionId.trim());
  if (options.stepId?.trim()) params.set("step", options.stepId.trim());
  return `/graph?${params.toString()}`;
}

export function addTransitionHref(fromTrackId: string, toTrackId: string): string {
  const params = new URLSearchParams({ fromTrackId, toTrackId });
  return `${libraryAddHref("transitions")}?${params.toString()}`;
}
