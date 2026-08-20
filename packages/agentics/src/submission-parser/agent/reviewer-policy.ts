import type { NoteProcessingPlan, NoteTransitionPlan } from "./schema";
import type { PolicyImportAction } from "./policy";
import type { ProposalPolicyResult } from "./proposal-policy";
import type { TrackCandidate } from "./services";

export type ReviewerEndpoint =
  | { kind: "track"; trackId: string }
  | {
      kind: "spotify";
      providerId: string;
      title: string;
      artists: string[];
      artworkUrl?: string | null;
      durationMs?: number | null;
    };

export type BuildReviewerPolicyResultInput = {
  plan: NoteProcessingPlan;
  from: ReviewerEndpoint;
  to: ReviewerEndpoint;
  bidirectional?: boolean;
  transition?: Partial<NoteTransitionPlan>;
};

function assertReviewerEndpoint(endpoint: unknown, field: string): ReviewerEndpoint {
  if (typeof endpoint !== "object" || endpoint === null || !("kind" in endpoint)) {
    throw new Error(`${field} must be a track or spotify endpoint.`);
  }
  const kind = (endpoint as { kind: unknown }).kind;
  if (kind === "track") {
    const trackId = (endpoint as { trackId?: unknown }).trackId;
    if (typeof trackId !== "string" || !trackId.trim()) {
      throw new Error(`${field}.trackId is required.`);
    }
    return { kind: "track", trackId: trackId.trim() };
  }
  if (kind === "spotify") {
    const spotify = endpoint as {
      providerId?: unknown;
      title?: unknown;
      artists?: unknown;
      artworkUrl?: unknown;
      durationMs?: unknown;
    };
    if (typeof spotify.providerId !== "string" || !spotify.providerId.trim()) {
      throw new Error(`${field}.providerId is required.`);
    }
    if (typeof spotify.title !== "string" || !spotify.title.trim()) {
      throw new Error(`${field}.title is required.`);
    }
    if (!Array.isArray(spotify.artists) || spotify.artists.length === 0) {
      throw new Error(`${field}.artists must be a non-empty array.`);
    }
    return {
      kind: "spotify",
      providerId: spotify.providerId.trim(),
      title: spotify.title.trim(),
      artists: spotify.artists.map((artist) => String(artist).trim()).filter(Boolean),
      artworkUrl: typeof spotify.artworkUrl === "string" ? spotify.artworkUrl : null,
      durationMs:
        typeof spotify.durationMs === "number" && Number.isFinite(spotify.durationMs)
          ? spotify.durationMs
          : null,
    };
  }
  throw new Error(
    `${field} must be kind "track" or "spotify" — free-text endpoints are not allowed.`,
  );
}

/**
 * Turn reviewer-selected endpoints into a normal auto-commit policy result.
 * Caller should set plan.confidence to `"full"` before applyProposalPolicy.
 */
export function buildReviewerPolicyResult(
  input: BuildReviewerPolicyResultInput,
): ProposalPolicyResult {
  const from = assertReviewerEndpoint(input.from, "from");
  const to = assertReviewerEndpoint(input.to, "to");

  const transition = input.plan.transitions[0];
  if (!transition) {
    throw new Error("Plan must include exactly one transition.");
  }

  const fromMentionId = transition.fromMentionId;
  const toMentionId = transition.toMentionId;
  const imports: PolicyImportAction[] = [];
  const resolvedTrackIdsByMention: Record<string, string> = {};

  const endpoints: Array<[string, ReviewerEndpoint]> = [
    [fromMentionId, from],
    [toMentionId, to],
  ];

  for (const [mentionId, endpoint] of endpoints) {
    if (endpoint.kind === "track") {
      resolvedTrackIdsByMention[mentionId] = endpoint.trackId;
    } else {
      const candidate: TrackCandidate = {
        handle: `spotify:${endpoint.providerId}`,
        title: endpoint.title,
        artists: endpoint.artists,
        artworkUrl: endpoint.artworkUrl ?? null,
        durationMs: endpoint.durationMs ?? null,
        provider: "spotify",
        providerId: endpoint.providerId,
      };
      imports.push({
        mentionId,
        providerId: endpoint.providerId,
        title: endpoint.title,
        artists: endpoint.artists,
        artworkUrl: endpoint.artworkUrl ?? null,
        durationMs: endpoint.durationMs ?? null,
        candidate,
      });
    }
  }

  const mergedTransition: NoteTransitionPlan = {
    ...transition,
    ...(input.transition ?? {}),
  };

  return {
    decision: "auto_commit",
    reasons: [{ code: "ok", message: "Reviewer approved endpoints." }],
    imports,
    commit: {
      transitionIndex: 0,
      fromMentionId,
      toMentionId,
      fromTrackId: resolvedTrackIdsByMention[fromMentionId] ?? "",
      toTrackId: resolvedTrackIdsByMention[toMentionId] ?? "",
      transition: mergedTransition,
    },
    resolvedTrackIdsByMention,
  };
}

export { assertReviewerEndpoint };
