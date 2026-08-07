export type LibraryView = "tracks" | "transitions" | "submissions";

export function parseLibraryView(raw: string | undefined | null): LibraryView {
  if (raw === "transitions" || raw === "submissions") return raw;
  return "tracks";
}
