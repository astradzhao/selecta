export type SequenceKind = "set" | "block";

export type SequenceGapState = "linked" | "available" | "unmapped" | "seam";

export type SequenceStepTrack = {
  id: string;
  title: string;
  artists: string[];
  artworkUrl: string | null;
  bpm: number | null;
  musicalKey: string | null;
  durationSec: number | null;
};

export type SequenceStepTransition = {
  id: string;
  fromTrackId: string;
  toTrackId: string;
  fromBar: number | null;
  toBar: number | null;
  barsOverlap: number | null;
  technique: string | null;
  intent: string | null;
  quality: string | null;
  notes: string | null;
};

export type SequenceStepBlock = {
  id: string;
  title: string;
  stepCount: number;
  seamCount: number;
  isComplete: boolean;
  runtimeSec: number;
};

export type SequenceStep = {
  id: string;
  position: number;
  trackId: string;
  inTransitionId: string | null;
  inBlockId: string | null;
  isSeam: boolean;
  note: string | null;
  gapState: SequenceGapState | null;
  candidateCount: number;
  transitionCandidateCount: number;
  track: SequenceStepTrack | null;
  inTransition: SequenceStepTransition | null;
  inBlock: SequenceStepBlock | null;
  createdAt: string;
  updatedAt: string;
};

export type SequenceAlternate = {
  id: string;
  label: string | null;
  fromStepId: string;
  toStepId: string;
  altTransitionId: string | null;
  altBlockId: string | null;
  valid: boolean;
  altTransition: SequenceStepTransition | null;
  altBlock: SequenceStepBlock | null;
  createdAt: string;
  updatedAt: string;
};

export type SequenceVersion = {
  id: string;
  name: string;
  alternateIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SequenceRecord = {
  id: string;
  kind: SequenceKind;
  title: string;
  description: string | null;
  startTrackId: string | null;
  endTrackId: string | null;
  isComplete: boolean;
  stepCount: number;
  seamCount: number;
  startTrack: SequenceStepTrack | null;
  endTrack: SequenceStepTrack | null;
  libraryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SequenceDetail = SequenceRecord & {
  steps: SequenceStep[];
  alternates: SequenceAlternate[];
  versions: SequenceVersion[];
};

export type WorkspaceSelection =
  | { kind: "none" }
  | { kind: "step"; stepId: string }
  | { kind: "gap"; stepId: string }
  | { kind: "span"; fromStepId: string; toStepId: string };

export type AlternateDraft = {
  fromStepId: string;
  toStepId: string;
  altTransitionId?: string;
  altBlockId?: string;
  summary: string;
};

export type SequenceReferrer = {
  id: string;
  title: string;
  kind: SequenceKind;
};

export type SequenceTrailSeed = {
  trackId: string;
  inTransitionId: string | null;
};

export type DragPayload =
  | { kind: "track"; id: string }
  | { kind: "transition"; id: string }
  | {
      kind: "block";
      id: string;
      title: string;
      stepCount: number;
      startTrackId: string | null;
      endTrackId: string | null;
      isComplete: boolean;
    };

export type DropTarget =
  | { kind: "gap"; index: number }
  | { kind: "step"; index: number }
  | { kind: "end"; index: number };
