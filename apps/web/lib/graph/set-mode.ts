import { addTransitionHref } from "@/lib/sequences/view";
import type {
  SequenceAlternate,
  SequenceExpansionEntry,
  SequenceStep,
} from "@/lib/sequences/types";

export type PlayPosition = {
  stepId: string;
  trackId: string;
  sequenceId: string;
  depth: number;
  inTransitionId: string | null;
  inBlockId: string | null;
  isSeam: boolean;
  title: string;
  artists: string[];
  artworkUrl: string | null;
};

export type HopClass = "on-script" | "alternate" | "seam" | "off-script";

export type GraphSetPin = {
  trackId: string;
  title: string;
  artists: string[];
  artworkUrl: string | null;
  onScript: boolean;
  plannedTransitionId: string | null;
  addHref: string | null;
  alternates: Array<{ id: string; label: string | null }>;
};

export type UpcomingAlternate = {
  id: string;
  label: string | null;
  valid: boolean;
  firstTrackId: string | null;
  firstStepId: string | null;
  title: string;
  artists: string[];
  artworkUrl: string | null;
};

export function playPathFromExpansion(entries: SequenceExpansionEntry[]): PlayPosition[] {
  return entries.map((entry) => ({
    stepId: entry.stepId,
    trackId: entry.trackId,
    sequenceId: entry.sequenceId,
    depth: entry.depth,
    inTransitionId: entry.inTransitionId,
    inBlockId: entry.inBlockId,
    isSeam: entry.isSeam,
    title: entry.track?.title ?? "Untitled",
    artists: entry.track?.artists ?? [],
    artworkUrl: entry.track?.artworkUrl ?? null,
  }));
}

export function playPathIndex(path: readonly PlayPosition[], stepId: string | null): number {
  if (!stepId) return 0;
  const index = path.findIndex((entry) => entry.stepId === stepId);
  return index < 0 ? 0 : index;
}

export function classifyHop(input: {
  path: readonly PlayPosition[];
  index: number;
  destinationTrackId: string;
  upcomingAlternateDestinations: readonly string[];
}): HopClass {
  const upcoming = input.path[input.index + 1];
  if (upcoming && upcoming.trackId === input.destinationTrackId) return "on-script";
  if (input.upcomingAlternateDestinations.includes(input.destinationTrackId)) return "alternate";
  if (upcoming?.isSeam) return "seam";
  return "off-script";
}

export function pinsForIndex(input: {
  path: readonly PlayPosition[];
  index: number;
  currentTrackId: string | null;
  upcomingAlts: readonly UpcomingAlternate[];
}): GraphSetPin[] {
  const upcoming = input.path[input.index + 1];
  if (upcoming?.isSeam) return [];
  const pins: GraphSetPin[] = [];

  function addPin(
    trackId: string,
    patch: Partial<Omit<GraphSetPin, "trackId" | "addHref">> &
      Pick<GraphSetPin, "title" | "artists" | "artworkUrl">,
  ) {
    const existing = pins.find((pin) => pin.trackId === trackId);
    if (existing) {
      if (patch.onScript) existing.onScript = true;
      if (patch.plannedTransitionId && !existing.plannedTransitionId) {
        existing.plannedTransitionId = patch.plannedTransitionId;
      }
      if (patch.alternates) existing.alternates.push(...patch.alternates);
      return;
    }
    pins.push({
      trackId,
      title: patch.title,
      artists: patch.artists,
      artworkUrl: patch.artworkUrl,
      onScript: Boolean(patch.onScript),
      plannedTransitionId: patch.plannedTransitionId ?? null,
      addHref: input.currentTrackId ? addTransitionHref(input.currentTrackId, trackId) : null,
      alternates: patch.alternates ?? [],
    });
  }

  if (upcoming) {
    addPin(upcoming.trackId, {
      title: upcoming.title,
      artists: upcoming.artists,
      artworkUrl: upcoming.artworkUrl,
      onScript: true,
      plannedTransitionId: upcoming.inTransitionId,
    });
  }
  for (const alt of input.upcomingAlts) {
    if (!alt.valid || !alt.firstTrackId) continue;
    addPin(alt.firstTrackId, {
      title: alt.title,
      artists: alt.artists,
      artworkUrl: alt.artworkUrl,
      alternates: [{ id: alt.id, label: alt.label }],
    });
  }
  return pins;
}

export function snapBackIndex(
  path: readonly PlayPosition[],
  afterIndex: number,
  trackId: string,
): number | null {
  const index = path.findIndex(
    (entry, entryIndex) => entryIndex > afterIndex && entry.trackId === trackId,
  );
  return index < 0 ? null : index;
}

export function skipSpanForOffscript(
  ownerSteps: readonly Pick<SequenceStep, "id" | "trackId">[],
  upcomingStepId: string,
  destinationTrackId: string,
): { fromStepId: string; toStepId: string } | null {
  const fromIdx = ownerSteps.findIndex((step) => step.id === upcomingStepId);
  if (fromIdx < 0 || fromIdx === 0) return null;
  const toIdx = ownerSteps.findIndex(
    (step, index) => index > fromIdx && step.trackId === destinationTrackId,
  );
  if (toIdx < 0) return null;
  return { fromStepId: upcomingStepId, toStepId: ownerSteps[toIdx]!.id };
}

export function insertPositionOnOwner(
  ownerSteps: readonly Pick<SequenceStep, "id">[],
  currentStepId: string,
): number | null {
  const index = ownerSteps.findIndex((step) => step.id === currentStepId);
  if (index < 0) return null;
  return index + 1;
}

export function alternateFirstHop(
  alt: Pick<SequenceAlternate, "altTransitionId" | "altBlockId" | "toStepId">,
  ownerSteps: readonly SequenceStep[],
  altBlockSteps: readonly SequenceStep[] | null,
): {
  trackId: string;
  stepId: string;
  title: string;
  artists: string[];
  artworkUrl: string | null;
} | null {
  if (alt.altTransitionId) {
    const to = ownerSteps.find((step) => step.id === alt.toStepId);
    return to
      ? {
          trackId: to.trackId,
          stepId: to.id,
          title: to.track?.title ?? "Untitled",
          artists: to.track?.artists ?? [],
          artworkUrl: to.track?.artworkUrl ?? null,
        }
      : null;
  }
  if (!alt.altBlockId || !altBlockSteps || altBlockSteps.length === 0) return null;
  const first = altBlockSteps[1] ?? altBlockSteps[0];
  return first
    ? {
        trackId: first.trackId,
        stepId: first.id,
        title: first.track?.title ?? "Untitled",
        artists: first.track?.artists ?? [],
        artworkUrl: first.track?.artworkUrl ?? null,
      }
    : null;
}

export function upcomingTitles(path: readonly PlayPosition[], index: number, count = 3): string[] {
  return path.slice(index + 1, index + 1 + count).map((entry) => entry.title);
}
