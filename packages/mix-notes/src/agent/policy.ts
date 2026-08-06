import type { NoteTransitionPlan } from "./schema";
import type { TrackCandidate } from "./services";

export type PolicyGateCode =
  | "ok"
  | "low_confidence"
  | "ambiguous_match"
  | "unresolved_endpoint"
  | "incomplete_transition"
  | "too_many_imports"
  | "too_many_transitions"
  | "invented_candidate"
  | "missing_required_fields"
  | "stale_version";

export type PolicyImportAction = {
  mentionId: string;
  providerId: string;
  title: string;
  artists: string[];
  artworkUrl?: string | null;
  durationMs?: number | null;
  candidate: TrackCandidate;
};

export type PolicyCommitAction = {
  transitionIndex: number;
  fromMentionId: string;
  toMentionId: string;
  fromTrackId: string;
  toTrackId: string;
  transition: NoteTransitionPlan;
};
