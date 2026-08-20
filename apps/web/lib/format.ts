export type ArtistInput = string[] | Array<{ name: string }>;

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Compact age for dense list columns: "now", "5m", "3h", "2d", then a short date. */
export function formatCompactAge(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
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

export function optionalNumberError(
  raw: string,
  message = "Must be a number.",
): string | undefined {
  return Number.isNaN(optionalNumber(raw)) ? message : undefined;
}
