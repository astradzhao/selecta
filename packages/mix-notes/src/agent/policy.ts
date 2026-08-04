import {
  parseCandidateHandle,
  type NoteMentionPlan,
  type NoteProcessingPlan,
  type NoteTransitionPlan,
} from "./schema";
import type { TrackCandidate } from "./services";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

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

export type PolicyDecision = "no_proposal" | "auto_commit" | "needs_review" | "reject";

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

export type PolicyResult = {
  decision: PolicyDecision;
  reasons: Array<{ code: PolicyGateCode; message: string }>;
  imports: PolicyImportAction[];
  commits: PolicyCommitAction[];
  resolvedTrackIdsByMention: Record<string, string>;
};

export type EvaluatePolicyInput = {
  plan: NoteProcessingPlan;
  /** Candidates returned by tools in this run, keyed by handle. */
  candidatesByHandle: Map<string, TrackCandidate>;
  /** All candidates returned for each mention (for uniqueness margins). */
  candidatesByMentionId?: Map<string, TrackCandidate[]>;
  overallConfidenceThreshold?: number;
  maxImports?: number;
  maxTransitions?: number;
};

function scoreTitleArtist(mention: NoteMentionPlan, candidate: TrackCandidate): number {
  const title = normalizeName(mention.titleHint ?? mention.mention);
  const artist = normalizeName(mention.artistHint ?? "");
  const candTitle = normalizeName(candidate.title);
  const candArtists = candidate.artists.map(normalizeName);

  let score = 0;
  if (title && candTitle === title) score += 0.6;
  else if (title && (candTitle.includes(title) || title.includes(candTitle))) score += 0.35;

  if (artist) {
    if (candArtists.some((name) => name === artist)) score += 0.4;
    else if (candArtists.some((name) => name.includes(artist) || artist.includes(name)))
      score += 0.2;
  } else {
    score += 0.1;
  }
  return Math.min(1, score);
}

function uniqueBestCandidate(
  mention: NoteMentionPlan,
  candidates: TrackCandidate[],
  minScore = 0.75,
  margin = 0.15,
): TrackCandidate | null {
  if (candidates.length === 0) return null;
  const ranked = [...candidates]
    .map((candidate) => ({ candidate, score: scoreTitleArtist(mention, candidate) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]!;
  const second = ranked[1];
  if (best.score < minScore) return null;
  if (second && best.score - second.score < margin) return null;
  return best.candidate;
}

/**
 * Deterministic post-agent policy. Model confidence alone cannot auto-commit.
 */
export function evaluateNoteProcessingPolicy(input: EvaluatePolicyInput): PolicyResult {
  const confidenceThreshold = input.overallConfidenceThreshold ?? 0.9;
  const maxImports = input.maxImports ?? 2;
  const maxTransitions = input.maxTransitions ?? 4;
  const reasons: PolicyResult["reasons"] = [];
  const imports: PolicyImportAction[] = [];
  const commits: PolicyCommitAction[] = [];
  const resolvedTrackIdsByMention: Record<string, string> = {};

  const { plan, candidatesByHandle } = input;
  const candidatesByMentionId = input.candidatesByMentionId ?? new Map<string, TrackCandidate[]>();

  if (plan.transitions.length === 0) {
    return {
      decision: "no_proposal",
      reasons: [{ code: "ok", message: "No transition proposals." }],
      imports: [],
      commits: [],
      resolvedTrackIdsByMention: {},
    };
  }

  if (plan.transitions.length > maxTransitions) {
    reasons.push({
      code: "too_many_transitions",
      message: `Plan has ${plan.transitions.length} transitions; max is ${maxTransitions}.`,
    });
  }

  if (plan.confidence < confidenceThreshold) {
    reasons.push({
      code: "low_confidence",
      message: `Overall confidence ${plan.confidence} below threshold ${confidenceThreshold}.`,
    });
  }

  if (plan.ambiguities.length > 0) {
    reasons.push({
      code: "ambiguous_match",
      message: `Plan lists ambiguities: ${plan.ambiguities.join("; ")}`,
    });
  }

  const mentionsById = new Map(plan.mentions.map((mention) => [mention.mentionId, mention]));

  for (const mention of plan.mentions) {
    const handle = mention.selectedCandidateId ?? null;
    if (!handle) {
      if (mention.resolutionStatus === "ambiguous") {
        reasons.push({
          code: "ambiguous_match",
          message: `Mention ${mention.mentionId} is ambiguous.`,
        });
      }
      continue;
    }

    const parsed = parseCandidateHandle(handle);
    const candidate = candidatesByHandle.get(handle);
    if (!parsed || !candidate) {
      reasons.push({
        code: "invented_candidate",
        message: `Mention ${mention.mentionId} selected unknown handle ${handle}.`,
      });
      continue;
    }

    const peerCandidates = candidatesByMentionId.get(mention.mentionId) ?? [candidate];

    if (parsed.kind === "graph" && candidate.trackId) {
      const graphPeers = peerCandidates.filter((item) => item.handle.startsWith("graph:"));
      const unique = uniqueBestCandidate(
        mention,
        graphPeers.length ? graphPeers : [candidate],
        0.75,
        0.15,
      );
      if (!unique || unique.handle !== candidate.handle) {
        reasons.push({
          code: "ambiguous_match",
          message: `Local match for ${mention.mentionId} failed uniqueness/quality gates.`,
        });
        continue;
      }
      resolvedTrackIdsByMention[mention.mentionId] = candidate.trackId;
      continue;
    }

    if (parsed.kind === "spotify" && candidate.providerId) {
      const spotifyPeers = peerCandidates.filter((item) => item.handle.startsWith("spotify:"));
      const unique = uniqueBestCandidate(mention, spotifyPeers.length ? spotifyPeers : [candidate]);
      if (!unique || unique.handle !== candidate.handle) {
        reasons.push({
          code: "ambiguous_match",
          message: `Spotify match for ${mention.mentionId} is not uniquely verified.`,
        });
        continue;
      }
      imports.push({
        mentionId: mention.mentionId,
        providerId: candidate.providerId,
        title: candidate.title,
        artists: candidate.artists,
        artworkUrl: candidate.artworkUrl,
        durationMs: candidate.durationMs,
        candidate,
      });
    }
  }

  if (imports.length > maxImports) {
    reasons.push({
      code: "too_many_imports",
      message: `Would import ${imports.length} tracks; max is ${maxImports}.`,
    });
  }

  // Only keep imports required by transitions once we know endpoints need them.
  const requiredMentionIds = new Set<string>();
  for (const transition of plan.transitions) {
    requiredMentionIds.add(transition.fromMentionId);
    requiredMentionIds.add(transition.toMentionId);
  }
  const filteredImports = imports.filter((action) => requiredMentionIds.has(action.mentionId));
  if (filteredImports.length < imports.length) {
    // Drop unused imports silently for auto path.
  }

  for (let index = 0; index < plan.transitions.length; index += 1) {
    const transition = plan.transitions[index]!;
    const fromMention = mentionsById.get(transition.fromMentionId);
    const toMention = mentionsById.get(transition.toMentionId);
    if (!fromMention || !toMention) {
      reasons.push({
        code: "incomplete_transition",
        message: `Transition ${index} references missing mention ids.`,
      });
      continue;
    }

    const fromId = resolvedTrackIdsByMention[transition.fromMentionId];
    const toId = resolvedTrackIdsByMention[transition.toMentionId];
    const fromImport = filteredImports.find((item) => item.mentionId === transition.fromMentionId);
    const toImport = filteredImports.find((item) => item.mentionId === transition.toMentionId);

    if (!fromId && !fromImport) {
      reasons.push({
        code: "unresolved_endpoint",
        message: `Transition ${index} fromMentionId=${transition.fromMentionId} is unresolved.`,
      });
    }
    if (!toId && !toImport) {
      reasons.push({
        code: "unresolved_endpoint",
        message: `Transition ${index} toMentionId=${transition.toMentionId} is unresolved.`,
      });
    }

    // Provisional commit entries; apply-plan fills track ids after imports.
    if ((fromId || fromImport) && (toId || toImport)) {
      commits.push({
        transitionIndex: index,
        fromMentionId: transition.fromMentionId,
        toMentionId: transition.toMentionId,
        fromTrackId: fromId ?? "",
        toTrackId: toId ?? "",
        transition,
      });
    }
  }

  const blocking = reasons.filter((reason) => reason.code !== "ok");
  if (blocking.length > 0 || filteredImports.length > maxImports) {
    return {
      decision: "needs_review",
      reasons: blocking.length ? blocking : reasons,
      imports: filteredImports.slice(0, maxImports),
      commits: [],
      resolvedTrackIdsByMention,
    };
  }

  if (commits.length === 0) {
    return {
      decision: "needs_review",
      reasons: [{ code: "unresolved_endpoint", message: "No fully resolved transitions." }],
      imports: filteredImports,
      commits: [],
      resolvedTrackIdsByMention,
    };
  }

  return {
    decision: "auto_commit",
    reasons: [{ code: "ok", message: "All auto-commit gates passed." }],
    imports: filteredImports,
    commits,
    resolvedTrackIdsByMention,
  };
}
