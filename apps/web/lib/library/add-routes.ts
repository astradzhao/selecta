import { matchLibraryView, type LibraryView } from "@/lib/library/view";

export type LibraryAddCategory = "tracks" | "submissions";

const ADD_PATHS: Record<LibraryAddCategory, string> = {
  tracks: "/library/add/tracks",
  submissions: "/library/add/submissions",
};

/** Href for a Library section. Tracks is the default view, so it has no query param. */
export function libraryViewHref(view: LibraryView): string {
  return view === "tracks" ? "/library" : `/library?view=${view}`;
}

/**
 * Href for an add sub-page. `from` records which section the user left, so Back can return there;
 * it is omitted when it would be redundant with the page's own default.
 */
export function libraryAddHref(category: LibraryAddCategory, from?: LibraryView): string {
  const path = ADD_PATHS[category];
  return from && from !== category ? `${path}?from=${from}` : path;
}

/**
 * Where an add sub-page's Back link points. `from` arrives from the URL and is untrusted: anything
 * not an exact known view falls back to the page's own section.
 */
export function libraryAddBackHref(from: string | undefined | null, fallback: LibraryView): string {
  return libraryViewHref(matchLibraryView(from) ?? fallback);
}
