export type AddMode = "track" | "transition";

export function parseAddMode(raw: string | undefined | null): AddMode {
  if (raw === "transition" || raw === "transitions") {
    return "transition";
  }
  return "track";
}
