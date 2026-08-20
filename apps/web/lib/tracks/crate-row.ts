/** Shared column geometry for the Library crate header and each track row. */
export const CRATE_TRACK_GRID =
  "grid grid-cols-[minmax(0,1fr)_3.25rem] items-center gap-4 px-3.5 sm:grid-cols-[minmax(0,1fr)_7.5rem_3.5rem_3.5rem_3.25rem]";

export function formatBpmKey(
  bpm: number | null | undefined,
  musicalKey: string | null | undefined,
): string | null {
  const bpmPart = bpm != null && Number.isFinite(bpm) ? String(Math.round(bpm)) : null;
  const keyPart = musicalKey?.trim() || null;
  if (bpmPart && keyPart) return `${bpmPart} · ${keyPart}`;
  return bpmPart ?? keyPart;
}
