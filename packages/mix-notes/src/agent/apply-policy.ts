import type { PolicyResult } from "./policy";
import type { NoteProcessingPlan } from "./schema";
import type { NoteAgentServices } from "./services";

export type ApplyPolicyInput = {
  plan: NoteProcessingPlan;
  policy: PolicyResult;
  services: NoteAgentServices;
  noteId: string;
  extractionVersion: number;
};

export type ApplyPolicyResult = {
  decision: PolicyResult["decision"];
  reasons: PolicyResult["reasons"];
  importedTrackIds: string[];
  committedProposalKeys: string[];
  failedProposalKeys: Array<{ proposalKey: string; error: string }>;
  resolvedTrackIdsByMention: Record<string, string>;
};

function proposalKey(noteId: string, version: number, index: number): string {
  return `${noteId}:${version}:${index}`;
}

/**
 * Apply deterministic imports/commits. Never invent tracks from free text.
 */
export async function applyNoteProcessingPolicy(
  input: ApplyPolicyInput,
): Promise<ApplyPolicyResult> {
  const { plan, policy, services, noteId, extractionVersion } = input;
  const resolved = { ...policy.resolvedTrackIdsByMention };
  const importedTrackIds: string[] = [];
  const committedProposalKeys: string[] = [];
  const failedProposalKeys: Array<{ proposalKey: string; error: string }> = [];

  if (policy.decision === "no_proposal") {
    return {
      decision: "no_proposal",
      reasons: policy.reasons,
      importedTrackIds: [],
      committedProposalKeys: [],
      failedProposalKeys: [],
      resolvedTrackIdsByMention: resolved,
    };
  }

  if (policy.decision !== "auto_commit") {
    return {
      decision: policy.decision,
      reasons: policy.reasons,
      importedTrackIds: [],
      committedProposalKeys: [],
      failedProposalKeys: [],
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

  for (const action of policy.commits) {
    const fromTrackId = resolved[action.fromMentionId];
    const toTrackId = resolved[action.toMentionId];
    const key = proposalKey(noteId, extractionVersion, action.transitionIndex);

    if (!fromTrackId || !toTrackId) {
      failedProposalKeys.push({
        proposalKey: key,
        error: `Missing resolved track for transition ${action.transitionIndex} (${action.fromMentionId} → ${action.toMentionId}).`,
      });
      continue;
    }

    try {
      const result = await services.commitTransition({
        fromTrackId,
        toTrackId,
        proposalKey: key,
        sourceNoteId: noteId,
        sourceNoteVersion: extractionVersion,
        confidence: plan.confidence,
        fromBar: action.transition.fromBar ?? null,
        toBar: action.transition.toBar ?? null,
        barsOverlap: action.transition.barsOverlap ?? null,
        technique: action.transition.technique ?? null,
        intent: action.transition.intent ?? null,
        quality: action.transition.quality ?? null,
        notes: action.transition.notes ?? null,
      });
      committedProposalKeys.push(result.proposalKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transition commit failed.";
      failedProposalKeys.push({ proposalKey: key, error: message });
    }
  }

  if (failedProposalKeys.length > 0) {
    return {
      decision: "reject",
      reasons: [
        ...policy.reasons,
        {
          code: "missing_required_fields",
          message: failedProposalKeys
            .map((item) => `${item.proposalKey}: ${item.error}`)
            .join(" | "),
        },
      ],
      importedTrackIds,
      committedProposalKeys,
      failedProposalKeys,
      resolvedTrackIdsByMention: resolved,
    };
  }

  return {
    decision: "auto_commit",
    reasons: policy.reasons,
    importedTrackIds,
    committedProposalKeys,
    failedProposalKeys: [],
    resolvedTrackIdsByMention: resolved,
  };
}
