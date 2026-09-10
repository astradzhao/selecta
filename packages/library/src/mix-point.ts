import { MusicWriteError } from "./errors";

export const HOT_CUE_MAX_LENGTH = 16;

export const PIONEER_HOT_CUES = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type PioneerHotCue = (typeof PIONEER_HOT_CUES)[number];

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Trim, drop empty, uppercase Pioneer A–H, reject labels longer than 16. */
export function optionalHotCue(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  if (trimmed.length > HOT_CUE_MAX_LENGTH) {
    throw new MusicWriteError(
      "invalid_input",
      `Hot cue must be ${HOT_CUE_MAX_LENGTH} characters or fewer.`,
    );
  }
  if (/^[a-h]$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}

/** Pioneer A–H, or Serato 1–8 mapped onto that bank. Named cues return null. */
export function pioneerHotCueSlot(cue: string | null | undefined): PioneerHotCue | null {
  const trimmed = trimOrNull(cue);
  if (!trimmed) return null;
  if (/^[A-Ha-h]$/.test(trimmed)) return trimmed.toUpperCase() as PioneerHotCue;
  if (/^[1-8]$/.test(trimmed)) return PIONEER_HOT_CUES[Number(trimmed) - 1] ?? null;
  return null;
}

export function formatMixPoint(
  cue: string | null | undefined,
  bar: number | null | undefined,
): string | null {
  const label = trimOrNull(cue);
  const measure = bar != null && Number.isFinite(bar) ? String(bar) : null;
  if (label && measure) return `${label} · ${measure}`;
  return label ?? measure;
}
