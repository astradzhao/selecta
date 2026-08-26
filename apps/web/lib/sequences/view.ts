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

export function addTransitionHref(fromTrackId: string, toTrackId: string): string {
  const params = new URLSearchParams({ fromTrackId, toTrackId });
  return `${libraryAddHref("transitions")}?${params.toString()}`;
}
