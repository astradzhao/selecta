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
