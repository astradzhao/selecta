import { parseCandidateHandle, type NoteProcessingPlan, type NoteTransitionPlan } from "./schema";
import { uniqueBestCandidate } from "./match";
import { SUBMISSION_LIMITS } from "./limits";
import type { PolicyCommitAction, PolicyGateCode, PolicyImportAction } from "./policy";
import type { TrackCandidate } from "./services";

export type ProposalPolicyDecision = "auto_commit" | "needs_review" | "no_proposal" | "reject";

export type ProposalPolicyResult = {
  decision: ProposalPolicyDecision;
  reasons: Array<{ code: PolicyGateCode; message: string }>;
  imports: PolicyImportAction[];
  commit: PolicyCommitAction | null;
  resolvedTrackIdsByMention: Record<string, string>;
};

export type EvaluateProposalPolicyInput = {
  /** Mini-plan with exactly one transition (index 0). */
  plan: NoteProcessingPlan;
  candidatesByHandle: Map<string, TrackCandidate>;
  candidatesByMentionId?: Map<string, TrackCandidate[]>;
  overallConfidenceThreshold?: number;
  maxImports?: number;
};

/**
 * Evaluate policy for a single transition proposal.
 * Unlike plan-level policy, sibling ambiguity cannot clear this proposal's commit.
 */
export function evaluateProposalPolicy(input: EvaluateProposalPolicyInput): ProposalPolicyResult {
  const confidenceThreshold = input.overallConfidenceThreshold ?? 0.9;
  const maxImports = input.maxImports ?? SUBMISSION_LIMITS.maxImportsPerProposal;
  const reasons: ProposalPolicyResult["reasons"] = [];
  const imports: PolicyImportAction[] = [];
  const resolvedTrackIdsByMention: Record<string, string> = {};

  const { plan, candidatesByHandle } = input;
  const candidatesByMentionId = input.candidatesByMentionId ?? new Map<string, TrackCandidate[]>();
  const transition: NoteTransitionPlan | undefined = plan.transitions[0];

  if (!transition) {
    return {
      decision: "no_proposal",
      reasons: [{ code: "ok", message: "No transition in proposal draft." }],
      imports: [],
      commit: null,
      resolvedTrackIdsByMention: {},
    };
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

  const requiredMentionIds = new Set([transition.fromMentionId, transition.toMentionId]);
  const filteredImports = imports.filter((action) => requiredMentionIds.has(action.mentionId));

  if (filteredImports.length > maxImports) {
    reasons.push({
      code: "too_many_imports",
      message: `Would import ${filteredImports.length} tracks; max is ${maxImports}.`,
    });
  }

  const fromMention = mentionsById.get(transition.fromMentionId);
  const toMention = mentionsById.get(transition.toMentionId);
  if (!fromMention || !toMention) {
    reasons.push({
      code: "incomplete_transition",
      message: "Transition references missing mention ids.",
    });
  }

  const fromId = resolvedTrackIdsByMention[transition.fromMentionId];
  const toId = resolvedTrackIdsByMention[transition.toMentionId];
  const fromImport = filteredImports.find((item) => item.mentionId === transition.fromMentionId);
  const toImport = filteredImports.find((item) => item.mentionId === transition.toMentionId);

  if (!fromId && !fromImport) {
    reasons.push({
      code: "unresolved_endpoint",
      message: `fromMentionId=${transition.fromMentionId} is unresolved.`,
    });
  }
  if (!toId && !toImport) {
    reasons.push({
      code: "unresolved_endpoint",
      message: `toMentionId=${transition.toMentionId} is unresolved.`,
    });
  }

  const blocking = reasons.filter((reason) => reason.code !== "ok");
  if (blocking.length > 0 || filteredImports.length > maxImports) {
    return {
      decision: "needs_review",
      reasons: blocking.length ? blocking : reasons,
      imports: filteredImports.slice(0, maxImports),
      commit: null,
      resolvedTrackIdsByMention,
    };
  }

  if (!(fromId || fromImport) || !(toId || toImport)) {
    return {
      decision: "needs_review",
      reasons: [{ code: "unresolved_endpoint", message: "Transition endpoints incomplete." }],
      imports: filteredImports,
      commit: null,
      resolvedTrackIdsByMention,
    };
  }

  return {
    decision: "auto_commit",
    reasons: [{ code: "ok", message: "Proposal auto-commit gates passed." }],
    imports: filteredImports,
    commit: {
      transitionIndex: 0,
      fromMentionId: transition.fromMentionId,
      toMentionId: transition.toMentionId,
      fromTrackId: fromId ?? "",
      toTrackId: toId ?? "",
      transition,
    },
    resolvedTrackIdsByMention,
  };
}
