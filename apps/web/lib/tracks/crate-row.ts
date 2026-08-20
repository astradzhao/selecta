/** Shared column geometry for the Library crate header and each track row. */
export const CRATE_TRACK_GRID =
  "grid grid-cols-[minmax(0,1fr)_3.25rem] items-center gap-4 px-3.5 sm:grid-cols-[minmax(0,1fr)_7.5rem_3.5rem_3.5rem_3.25rem]";

/** Max subgenre chips on a crate row so the title still has room to truncate. */
export const CRATE_SUBGENRE_LIMIT = 3;

export function formatBpmKey(
  bpm: number | null | undefined,
  musicalKey: string | null | undefined,
): string {
  const bpmPart = bpm != null && Number.isFinite(bpm) ? String(Math.round(bpm)) : "-";
  const keyPart = musicalKey?.trim() || "-";
  return `${bpmPart} / ${keyPart}`;
}
