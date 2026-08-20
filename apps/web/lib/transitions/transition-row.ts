/** Shared column geometry for the Library transition header and each edge row. */
export const CRATE_TRANSITION_GRID =
  "grid grid-cols-[minmax(0,1fr)_1.875rem_minmax(0,1fr)] items-center gap-3.5 px-3.5 sm:grid-cols-[minmax(0,1fr)_1.875rem_minmax(0,1fr)_9.25rem_5.25rem_3.5rem]";

const EMPTY_SLOT = "-";

/** Both slots stay visible so the row keeps its shape when a side is unknown. */
export const EMPTY_SHIFT = `${EMPTY_SLOT} → ${EMPTY_SLOT}`;

function bpmSlot(bpm: number | null | undefined): string {
  return bpm != null && Number.isFinite(bpm) ? String(Math.round(bpm)) : EMPTY_SLOT;
}

function keySlot(musicalKey: string | null | undefined): string {
  return musicalKey?.trim() || EMPTY_SLOT;
}

export function formatBpmShift(
  fromBpm: number | null | undefined,
  toBpm: number | null | undefined,
): string {
  return `${bpmSlot(fromBpm)} → ${bpmSlot(toBpm)}`;
}

export function formatKeyShift(
  fromKey: string | null | undefined,
  toKey: string | null | undefined,
): string {
  return `${keySlot(fromKey)} → ${keySlot(toKey)}`;
}
