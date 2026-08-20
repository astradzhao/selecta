export type ArtistInput = string[] | Array<{ name: string }>;

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function artistLine(artists: ArtistInput): string {
  if (artists.length === 0) return "Unknown artist";
  const names =
    typeof artists[0] === "string"
      ? (artists as string[])
      : (artists as Array<{ name: string }>).map((artist) => artist.name);
  return names.join(", ") || "Unknown artist";
}

export function previewText(
  text: string,
  { maxLength, fallback }: { maxLength: number; fallback: string },
): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? trimmed;
  return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength - 3)}…` : firstLine;
}

export function formatDuration(
  value: number | null,
  unit: "seconds" | "milliseconds" = "seconds",
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const total = Math.round(unit === "milliseconds" ? value / 1000 : value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}
