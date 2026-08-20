export const LIBRARY_VIEWS = ["tracks", "transitions", "submissions"] as const;

export type LibraryView = (typeof LIBRARY_VIEWS)[number];

export function matchLibraryView(raw: string | undefined | null): LibraryView | null {
  return LIBRARY_VIEWS.includes(raw as LibraryView) ? (raw as LibraryView) : null;
}

export function parseLibraryView(raw: string | undefined | null): LibraryView {
  return matchLibraryView(raw) ?? "tracks";
}
