import { MusicWriteError } from "./errors";

export const HOT_CUE_MAX_LENGTH = 16;

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

export function formatMixPoint(
  cue: string | null | undefined,
  bar: number | null | undefined,
): string | null {
  const label = trimOrNull(cue);
  const measure = bar != null && Number.isFinite(bar) ? String(bar) : null;
  if (label && measure) return `${label} · ${measure}`;
  return label ?? measure;
}
