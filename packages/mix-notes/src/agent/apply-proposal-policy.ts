import type { ProposalPolicyResult } from "./proposal-policy";
import type { NoteProcessingPlan } from "./schema";
import type { NoteAgentServices } from "./services";

export type ApplyProposalPolicyInput = {
  plan: NoteProcessingPlan;
  policy: ProposalPolicyResult;
  services: NoteAgentServices;
  noteId: string;
  extractionVersion: number;
  /** Fingerprint-based key: `{noteId}:{version}:span:{fingerprint}`. */
  proposalKey: string;
};

export type ApplyProposalPolicyResult = {
  decision: ProposalPolicyResult["decision"];
  reasons: ProposalPolicyResult["reasons"];
  importedTrackIds: string[];
  committed: boolean;
  commitError: string | null;
  fromTrackId: string | null;
  toTrackId: string | null;
  resolvedTrackIdsByMention: Record<string, string>;
};

/**
 * Apply imports + commit for one proposal. Never invents tracks from free text.
 * Idempotent via Neo4j MERGE on proposalKey.
 */
export async function applyProposalPolicy(
  input: ApplyProposalPolicyInput,
): Promise<ApplyProposalPolicyResult> {
  const { plan, policy, services, noteId, extractionVersion, proposalKey } = input;
  const resolved = { ...policy.resolvedTrackIdsByMention };
  const importedTrackIds: string[] = [];

  if (policy.decision === "no_proposal") {
    return {
      decision: "no_proposal",
      reasons: policy.reasons,
      importedTrackIds: [],
      committed: false,
      commitError: null,
      fromTrackId: null,
      toTrackId: null,
      resolvedTrackIdsByMention: resolved,
    };
  }

  if (policy.decision !== "auto_commit" || !policy.commit) {
    return {
      decision: policy.decision,
      reasons: policy.reasons,
      importedTrackIds: [],
      committed: false,
      commitError: null,
      fromTrackId: null,
      toTrackId: null,
      resolvedTrackIdsByMention: resolved,
    };
  }

  for (const action of policy.imports) {
    const imported = await services.importSpotifyTrack({
      providerId: action.providerId,
      title: action.title,
      artists: action.artists,
      artworkUrl: action.artworkUrl,
      durationMs: action.durationMs,
      genres: [],
    });
    resolved[action.mentionId] = imported.trackId;
    if (!importedTrackIds.includes(imported.trackId)) {
      importedTrackIds.push(imported.trackId);
    }
  }

  const fromTrackId = resolved[policy.commit.fromMentionId] ?? null;
  const toTrackId = resolved[policy.commit.toMentionId] ?? null;

  if (!fromTrackId || !toTrackId) {
    return {
      decision: "reject",
      reasons: [
        ...policy.reasons,
        {
          code: "missing_required_fields",
          message: `Missing resolved track for ${policy.commit.fromMentionId} → ${policy.commit.toMentionId}.`,
        },
      ],
      importedTrackIds,
      committed: false,
      commitError: "Missing resolved endpoints after import.",
      fromTrackId,
      toTrackId,
      resolvedTrackIdsByMention: resolved,
    };
  }

  try {
    await services.commitTransition({
      fromTrackId,
      toTrackId,
      proposalKey,
      sourceNoteId: noteId,
      sourceNoteVersion: extractionVersion,
      confidence: plan.confidence,
      fromBar: policy.commit.transition.fromBar ?? null,
      toBar: policy.commit.transition.toBar ?? null,
      barsOverlap: policy.commit.transition.barsOverlap ?? null,
      technique: policy.commit.transition.technique ?? null,
      intent: policy.commit.transition.intent ?? null,
      quality: policy.commit.transition.quality ?? null,
      notes: policy.commit.transition.notes ?? null,
    });
    return {
      decision: "auto_commit",
      reasons: policy.reasons,
      importedTrackIds,
      committed: true,
      commitError: null,
      fromTrackId,
      toTrackId,
      resolvedTrackIdsByMention: resolved,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transition commit failed.";
    return {
      decision: "reject",
      reasons: [
        ...policy.reasons,
        { code: "missing_required_fields", message },
      ],
      importedTrackIds,
      committed: false,
      commitError: message,
      fromTrackId,
      toTrackId,
      resolvedTrackIdsByMention: resolved,
    };
  }
}
