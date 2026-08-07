import { randomUUID } from "node:crypto";

import { MusicWriteError } from "./errors";
import { normalizeName } from "./normalize";
import type { TrackExternalIds } from "./types";

export type VocabParams = {
  id: string;
  name: string;
  nameNormalized: string;
};

export function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new MusicWriteError("invalid_input", `${label} must not be empty.`);
  }
  return trimmed;
}

export function optionalNumber(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  return value;
}

/** Round to whole seconds for integer `duration_sec` (Spotify ms → sec is often fractional). */
export function optionalDurationSec(value: number | null | undefined): number | null {
  const n = optionalNumber(value);
  return n === null ? null : Math.round(n);
}

export function optionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function prepareVocab(name: string, label: string): VocabParams {
  const display = requireTrimmed(name, label);
  return {
    id: randomUUID(),
    name: display,
    nameNormalized: normalizeName(display),
  };
}

/**
 * Trim + lowercase providers; drop empty entries.
 * Provider keys must not contain `:` (ids may).
 */
export function cleanExternalIds(
  externalIds: TrackExternalIds | undefined,
): Record<string, string> {
  if (!externalIds) {
    return {};
  }
  const cleaned: Record<string, string> = {};
  for (const [provider, value] of Object.entries(externalIds)) {
    const key = provider.trim().toLowerCase();
    const id = value?.trim();
    if (!key || !id) {
      continue;
    }
    if (key.includes(":")) {
      throw new MusicWriteError(
        "invalid_input",
        `External id provider must not contain ":". Got "${provider.trim()}".`,
      );
    }
    cleaned[key] = id;
  }
  return cleaned;
}
