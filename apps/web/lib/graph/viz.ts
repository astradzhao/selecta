/** Pure graph-viz helpers — bar counts and meter fills, not ranking. */

export function barStripTickCount(
  fromBar: number | null,
  toBar: number | null,
  overlap: number | null,
): number | null {
  if (fromBar == null && toBar == null && overlap == null) return null;
  const maxBar = Math.max(fromBar ?? 0, toBar ?? 0, 16);
  return Math.min(32, Math.max(8, Math.ceil(maxBar / 4) * 4));
}

export function qualityFill(quality: string | null | undefined): number | null {
  if (quality === "great") return 1;
  if (quality === "ok") return 0.55;
  if (quality === "risky") return 0.25;
  return null;
}

export function clampConfidence(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

export function formatGraphLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function qualityBadgeTone(quality: string | null): "default" | "secondary" | "outline" {
  if (quality === "great") return "default";
  if (quality === "ok") return "secondary";
  return "outline";
}
