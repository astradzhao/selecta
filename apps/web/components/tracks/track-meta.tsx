import { formatDuration } from "@/lib/format";
import type { ApiTrack } from "@/lib/tracks/types";

type TrackMetaFields = Pick<ApiTrack, "bpm" | "musicalKey" | "durationSec">;

/**
 * Right-rail readout for a crate row: BPM, key, length. Only duration comes from the
 * catalog, so each slot is dropped when unset rather than held open as a placeholder —
 * duration stays last so the common case still aligns into a column down the list.
 */
export function TrackMeta({ track }: { track: TrackMetaFields }) {
  const parts = [
    track.bpm != null ? `${Math.round(track.bpm)} BPM` : null,
    track.musicalKey?.trim() || null,
    formatDuration(track.durationSec),
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) {
    return null;
  }

  return (
    <div className="text-caption text-numeric hidden shrink-0 items-center gap-3 sm:flex">
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
    </div>
  );
}
