import { randomUUID } from "node:crypto";

import neo4j, { type ManagedTransaction } from "neo4j-driver";

import { getDriver } from "../client";
import { normalizeName } from "../normalize";
import { GraphWriteError, type SongExternalIds } from "../types";

export type VocabParams = {
  id: string;
  name: string;
  nameNormalized: string;
};

export function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new GraphWriteError("invalid_input", `${label} must not be empty.`);
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

export function cleanExternalIds(externalIds: SongExternalIds | undefined): Record<string, string> {
  if (!externalIds) {
    return {};
  }
  const cleaned: Record<string, string> = {};
  for (const [provider, value] of Object.entries(externalIds)) {
    const key = provider.trim();
    const id = value?.trim();
    if (key && id) {
      cleaned[key] = id;
    }
  }
  return cleaned;
}

export async function runWrite<T>(work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}
