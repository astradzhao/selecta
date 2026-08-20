import { runInDbTransaction, type SubmissionProposal } from "@selecta/db";
import { getTransitionById } from "@selecta/library";
import {
  getProposalById,
  insertProposalReviewEvent,
  refreshSubmissionExtractionStatus,
  updateProposal,
  upsertTransitionCommit,
} from "@selecta/submissions";
import {
  applyProposalPolicy,
  draftToSingleUnresolvedPlan,
  evaluateProposalPolicy,
  resolveProposalsBatch,
  type SubmissionAgentServices,
  type SubmissionProcessingPlan,
  type ProposalPolicyResult,
  type SingleTransitionDraft,
} from "@selecta/agentics/submission-parser";

import { createSubmissionAgentServices } from "@/lib/submission-agent-services";
import { serializeProposal } from "@/lib/proposals";
import { serializeTransition, summarizeProposalForTransition } from "@/lib/transitions";

export type CommitProposalResult = {
  proposal: Awaited<ReturnType<typeof serializeProposal>>;
  transition: ReturnType<typeof serializeTransition> | null;
  reverseTransition: ReturnType<typeof serializeTransition> | null;
  alreadyCommitted: boolean;
};

export async function loadCommittedTransition(proposal: SubmissionProposal) {
  const policyResult = proposal.policyResult;
  const applied =
    policyResult && typeof policyResult === "object" && !Array.isArray(policyResult)
      ? (policyResult as Record<string, unknown>).applied
      : null;
  const transitionId =
    applied && typeof applied === "object" && !Array.isArray(applied)
      ? (applied as Record<string, unknown>).transitionId
      : null;
  if (typeof transitionId !== "string" || !transitionId.trim()) {
    return { transition: null, reverseTransition: null };
  }

  const transition = await getTransitionById(transitionId);
  const reverseId =
    applied && typeof applied === "object" && !Array.isArray(applied)
      ? (applied as Record<string, unknown>).reverseTransitionId
      : null;
  const reverseTransition =
    typeof reverseId === "string" && reverseId.trim() ? await getTransitionById(reverseId) : null;

  return {
    transition: transition
      ? serializeTransition(transition, summarizeProposalForTransition(proposal))
      : null,
    reverseTransition: reverseTransition
      ? serializeTransition(reverseTransition, summarizeProposalForTransition(proposal))
      : null,
  };
}

export async function commitProposalPolicy(input: {
  proposal: SubmissionProposal;
  plan: SubmissionProcessingPlan;
  policy: ProposalPolicyResult;
  services?: SubmissionAgentServices;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewAction?: "approve" | "resolve";
}): Promise<CommitProposalResult> {
  const services = input.services ?? createSubmissionAgentServices();
  const reviewReasons = input.policy.reasons.filter((reason) => reason.code !== "ok");
  const now = new Date();

  await runInDbTransaction(async () => {
    const result = await applyProposalPolicy({
      plan: input.plan,
      policy: input.policy,
      services,
      submissionId: input.proposal.submissionId,
      extractionVersion: input.proposal.extractionVersion,
      proposalKey: input.proposal.proposalKey,
      sourceProposalId: input.proposal.id,
    });
    if (!result.committed) {
      throw new Error(result.commitError ?? "Transition commit failed.");
    }

    await upsertTransitionCommit({
      submissionId: input.proposal.submissionId,
      extractionVersion: input.proposal.extractionVersion,
      proposalKey: input.proposal.proposalKey,
      status: "committed",
      fromTrackId: result.fromTrackId,
      toTrackId: result.toTrackId,
      payload: {
        decision: result.decision,
        importedTrackIds: result.importedTrackIds,
        bidirectional: Boolean(input.plan.bidirectional),
        transitionId: result.transitionId,
        reviewed: true,
      },
    });

    if (input.plan.bidirectional && result.fromTrackId && result.toTrackId) {
      await upsertTransitionCommit({
        submissionId: input.proposal.submissionId,
        extractionVersion: input.proposal.extractionVersion,
        proposalKey: `${input.proposal.proposalKey}:rev`,
        status: "committed",
        fromTrackId: result.toTrackId,
        toTrackId: result.fromTrackId,
        payload: {
          decision: result.decision,
          reverseOf: input.proposal.proposalKey,
          transitionId: result.reverseTransitionId,
        },
      });
    }

    await updateProposal(input.proposal.id, {
      status: "committed",
      error: null,
      reviewedAt: now,
      reviewedBy: input.reviewedBy ?? null,
      reviewNote: input.reviewNote ?? null,
      policyResult: {
        ...input.policy,
        reviewReasons,
        applied: result,
        reviewer: true,
      } as unknown as Record<string, unknown>,
    });

    await insertProposalReviewEvent({
      proposalId: input.proposal.id,
      action: input.reviewAction ?? "approve",
      actor: input.reviewedBy ?? null,
      payload: {
        transitionId: result.transitionId,
        reverseTransitionId: result.reverseTransitionId,
      },
    });

    await refreshSubmissionExtractionStatus(
      input.proposal.submissionId,
      input.proposal.extractionVersion,
    );
  });

  const refreshed = await getProposalById(input.proposal.id);
  if (!refreshed) {
    throw new Error("Proposal missing after commit.");
  }

  const { transition, reverseTransition } = await loadCommittedTransition(refreshed);
  return {
    proposal: await serializeProposal(refreshed),
    transition,
    reverseTransition,
    alreadyCommitted: false,
  };
}

export async function resolveSingleProposal(proposalId: string): Promise<{
  proposal: Awaited<ReturnType<typeof serializeProposal>>;
  transition: ReturnType<typeof serializeTransition> | null;
  reverseTransition: ReturnType<typeof serializeTransition> | null;
  committed: boolean;
}> {
  const proposal = await getProposalById(proposalId);
  if (!proposal) {
    throw new Error("not_found");
  }

  if (proposal.status === "committed") {
    const loaded = await loadCommittedTransition(proposal);
    return {
      proposal: await serializeProposal(proposal),
      ...loaded,
      committed: true,
    };
  }

  const draft = proposal.draft as SingleTransitionDraft | null;
  if (!draft) {
    throw new Error("missing_draft");
  }

  const services = createSubmissionAgentServices();
  await updateProposal(proposal.id, { status: "resolving" });

  const resolved = await resolveProposalsBatch({
    items: [
      {
        proposalId: proposal.id,
        proposalKey: proposal.proposalKey,
        plan: draftToSingleUnresolvedPlan(draft),
      },
    ],
    services,
  });

  const item = resolved.items[0];
  if (!item) {
    throw new Error("resolve_failed");
  }

  const policy = evaluateProposalPolicy({
    plan: item.plan,
    candidatesByHandle: item.candidatesByHandle,
    candidatesByMentionId: item.candidatesByMentionId,
  });
  const reviewReasons = policy.reasons.filter((reason) => reason.code !== "ok");

  await updateProposal(proposal.id, {
    resolution: {
      plan: item.plan,
      candidates: Object.fromEntries(
        [...item.candidatesByMentionId.entries()].map(([mentionId, candidates]) => [
          mentionId,
          candidates,
        ]),
      ),
    },
    policyResult: {
      ...policy,
      reviewReasons,
    } as unknown as Record<string, unknown>,
  });

  if (policy.decision !== "auto_commit") {
    await updateProposal(proposal.id, {
      status: policy.decision === "no_proposal" ? "failed" : "needs_review",
    });
    await insertProposalReviewEvent({
      proposalId: proposal.id,
      action: "resolve",
      payload: { decision: policy.decision, reviewReasons },
    });
    await refreshSubmissionExtractionStatus(proposal.submissionId, proposal.extractionVersion);
    const refreshed = await getProposalById(proposal.id);
    if (!refreshed) {
      throw new Error("not_found");
    }
    return {
      proposal: await serializeProposal(refreshed),
      transition: null,
      reverseTransition: null,
      committed: false,
    };
  }

  const commitResult = await commitProposalPolicy({
    proposal,
    plan: item.plan,
    policy,
    reviewAction: "resolve",
  });

  return {
    proposal: commitResult.proposal,
    transition: commitResult.transition,
    reverseTransition: commitResult.reverseTransition,
    committed: true,
  };
}
