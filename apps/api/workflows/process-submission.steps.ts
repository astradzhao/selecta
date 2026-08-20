import {
  applyProposalPolicy,
  buildOrchestratorPrompt,
  buildOrchestratorUserPrompt,
  confidenceToUnitInterval,
  DEFAULT_ORCHESTRATOR_MODEL,
  draftToSingleUnresolvedPlan,
  evaluateProposalPolicy,
  ORCHESTRATOR_AGENT_NAME,
  ORCHESTRATOR_PROMPT_VERSION,
  ParseSingleTransitionInputSchema,
  parseSingleTransitionDraft,
  resolveProposalsBatch,
  sourceFingerprint,
  spanProposalKey,
  SUBMISSION_LIMITS,
  type ConfidenceLevel,
  type ParseSingleTransitionReceipt,
  type SingleTransitionDraft,
} from "@selecta/agentics/submission-parser";
import { isPostgresConfigured, runInDbTransaction, type SubmissionProposal } from "@selecta/db";
import {
  claimProposal,
  completeExtraction,
  countProposalsForVersion,
  deriveSubmissionExtractionStatus,
  failExtraction,
  finishAgentRun,
  getSubmissionById,
  getProposalById,
  getProposalByKey,
  listProposalsForVersion,
  startAgentRun,
  updateProposal,
  upsertTransitionCommit,
} from "@selecta/submissions";
import { FatalError, RetryableError } from "workflow";

import { createSubmissionAgentServices } from "@/lib/submission-agent-services";

export type ProcessSubmissionInput = {
  submissionId: string;
  extractionVersion: number;
};

export type OrchestratorContext = {
  submissionId: string;
  extractionVersion: number;
  agentRunId: string;
  workflowRunId: string;
  rawText: string;
};

export type OrchestratorConfig = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxSteps: number;
  maxTransitions: number;
};

export type ApplySummary = {
  proposalCount: number;
  committed: number;
  needsReview: number;
  failed: number;
};

function hasAiGatewayAuth(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    process.env.AWS_ROLE_ARN ||
    process.env.VERCEL,
  );
}

export async function beginOrchestration(
  input: ProcessSubmissionInput & { workflowRunId: string },
): Promise<OrchestratorContext | null> {
  "use step";

  console.log(
    `[submission-workflow] begin submission=${input.submissionId} version=${input.extractionVersion} run=${input.workflowRunId}`,
  );

  if (!isPostgresConfigured()) {
    return null;
  }

  const submission = await getSubmissionById(input.submissionId);
  if (!submission) {
    return null;
  }
  if (
    submission.extractionVersion !== input.extractionVersion ||
    submission.extractionStatus !== "extracting"
  ) {
    console.log(
      `[submission-workflow] skip stale submission=${input.submissionId} version=${input.extractionVersion} status=${submission.extractionStatus}`,
    );
    return null;
  }

  if (!hasAiGatewayAuth()) {
    await failExtraction(
      input.submissionId,
      input.extractionVersion,
      "AI Gateway auth is not configured (set AI_GATEWAY_API_KEY locally, or use Vercel OIDC when deployed).",
    );
    throw new FatalError("AI Gateway auth is not configured.");
  }

  const agentRun = await startAgentRun({
    submissionId: input.submissionId,
    extractionVersion: input.extractionVersion,
    agentName: ORCHESTRATOR_AGENT_NAME,
    workflowRunId: input.workflowRunId,
    promptVersion: ORCHESTRATOR_PROMPT_VERSION,
  });

  return {
    submissionId: input.submissionId,
    extractionVersion: input.extractionVersion,
    agentRunId: agentRun.id,
    workflowRunId: input.workflowRunId,
    rawText: submission.rawText,
  };
}

/**
 * Resolve model + orchestrator prompts in a step so the workflow sandbox
 * never imports @selecta/agentics/submission-parser (and its node:crypto graph).
 */
export async function resolveOrchestratorConfig(
  ctx: OrchestratorContext,
): Promise<OrchestratorConfig> {
  "use step";

  const model =
    process.env.SUBMISSION_ORCHESTRATOR_MODEL?.trim() ||
    process.env.SUBMISSION_AGENT_MODEL?.trim() ||
    DEFAULT_ORCHESTRATOR_MODEL;
  const prompt = buildOrchestratorPrompt(SUBMISSION_LIMITS.maxTransitions);

  return {
    model,
    systemPrompt: prompt.system,
    userPrompt: buildOrchestratorUserPrompt(ctx.rawText, {
      submissionId: ctx.submissionId,
      extractionVersion: ctx.extractionVersion,
    }),
    maxSteps: SUBMISSION_LIMITS.maxOrchestrationSteps,
    maxTransitions: SUBMISSION_LIMITS.maxTransitions,
  };
}

/**
 * Child parse tool: one cheap structured-output call + Postgres proposal persistence.
 * Returns only a minimal receipt to the parent orchestrator.
 */
export async function parseSingleTransitionTool(rawInput: {
  submissionId: string;
  extractionVersion: number;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
  agentRunId: string;
}): Promise<ParseSingleTransitionReceipt> {
  "use step";

  const parsedInput = ParseSingleTransitionInputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return {
      ok: false,
      proposalId: null,
      retryable: false,
      error: "Invalid parse_single_transition input.",
    };
  }

  const { submissionId, extractionVersion, sourceStart, sourceEnd, sourceText } = parsedInput.data;

  if (sourceEnd < sourceStart || sourceText.length === 0) {
    return {
      ok: false,
      proposalId: null,
      retryable: false,
      error: "Invalid source span.",
    };
  }

  // Always compute fingerprint server-side — never trust model-supplied values.
  const fingerprint = sourceFingerprint(sourceStart, sourceEnd, sourceText);
  const proposalKey = spanProposalKey(submissionId, extractionVersion, fingerprint);

  const existingCounts = await countProposalsForVersion(submissionId, extractionVersion);
  const existing = await getProposalByKey(proposalKey);
  if (!existing && existingCounts.total >= SUBMISSION_LIMITS.maxTransitions) {
    const message = `Dispatch limit exceeded (${SUBMISSION_LIMITS.maxTransitions} transitions).`;
    console.error(`[submission-workflow] ${message}`);
    return { ok: false, proposalId: null, retryable: false, error: message };
  }

  const claimed = await claimProposal({
    submissionId: submissionId,
    extractionVersion,
    agentRunId: rawInput.agentRunId,
    sourceStart,
    sourceEnd,
    sourceText,
    sourceFingerprint: fingerprint,
    proposalKey,
  });

  if (claimed.created) {
    const afterClaim = await countProposalsForVersion(submissionId, extractionVersion);
    if (afterClaim.total > SUBMISSION_LIMITS.maxTransitions) {
      const message = `Dispatch limit exceeded (${SUBMISSION_LIMITS.maxTransitions} transitions).`;
      await updateProposal(claimed.proposal.id, {
        status: "failed",
        error: message,
      });
      return {
        ok: false,
        proposalId: claimed.proposal.id,
        retryable: false,
        error: message,
      };
    }
  }

  if (
    claimed.proposal.draft &&
    (claimed.proposal.status === "ready" ||
      claimed.proposal.status === "resolving" ||
      claimed.proposal.status === "needs_review" ||
      claimed.proposal.status === "committed" ||
      claimed.proposal.status === "failed" ||
      claimed.proposal.status === "rejected")
  ) {
    return { ok: true, proposalId: claimed.proposal.id, retryable: false, error: null };
  }

  const attemptCount = (claimed.proposal.attemptCount ?? 0) + (claimed.created ? 0 : 1);
  if (attemptCount > SUBMISSION_LIMITS.maxChildRetries + 1) {
    await updateProposal(claimed.proposal.id, {
      status: "failed",
      attemptCount,
      error: "Child parse retries exhausted.",
    });
    throw new FatalError("Child parse retries exhausted.");
  }

  await updateProposal(claimed.proposal.id, {
    status: "parsing",
    attemptCount: Math.max(attemptCount, 1),
  });

  const parseResult = await parseSingleTransitionDraft({
    sourceText,
    runId: claimed.proposal.id,
  });

  if (!parseResult.ok) {
    await updateProposal(claimed.proposal.id, {
      status: "failed",
      error: parseResult.error.message,
      model: parseResult.model,
      promptVersion: parseResult.promptVersion,
      attemptCount: Math.max(attemptCount, 1),
    });
    if (parseResult.error.retryable) {
      throw new RetryableError(parseResult.error.message);
    }
    return {
      ok: false,
      proposalId: claimed.proposal.id,
      retryable: false,
      error: parseResult.error.message,
    };
  }

  await updateProposal(claimed.proposal.id, {
    status: "ready",
    draft: parseResult.draft as unknown as Record<string, unknown>,
    model: parseResult.model,
    promptVersion: parseResult.promptVersion,
    usage: (parseResult.usage as Record<string, unknown> | undefined) ?? null,
    error: null,
    attemptCount: Math.max(attemptCount, 1),
  });

  console.log(`[submission-workflow] parsed proposal=${claimed.proposal.id} key=${proposalKey}`);

  return { ok: true, proposalId: claimed.proposal.id, retryable: false, error: null };
}

export async function resolveAndApplyProposals(ctx: OrchestratorContext): Promise<ApplySummary> {
  "use step";

  console.log(
    `[submission-workflow] resolve/apply submission=${ctx.submissionId} version=${ctx.extractionVersion}`,
  );

  const proposals = await listProposalsForVersion(ctx.submissionId, ctx.extractionVersion);
  const ready = proposals.filter(
    (proposal) =>
      proposal.status === "ready" ||
      proposal.status === "resolving" ||
      (proposal.status === "needs_review" && proposal.draft),
  );

  if (ready.length === 0) {
    return { proposalCount: 0, committed: 0, needsReview: 0, failed: 0 };
  }

  const services = createSubmissionAgentServices();
  const items = [];

  for (const proposal of ready) {
    const draft = proposal.draft as SingleTransitionDraft | null;
    if (!draft) {
      await updateProposal(proposal.id, {
        status: "failed",
        error: "Missing draft for resolve.",
      });
      continue;
    }
    await updateProposal(proposal.id, { status: "resolving" });
    items.push({
      proposalId: proposal.id,
      proposalKey: proposal.proposalKey,
      plan: draftToSingleUnresolvedPlan(draft),
    });
  }

  if (items.length === 0) {
    return { proposalCount: 0, committed: 0, needsReview: 0, failed: 0 };
  }

  const resolved = await resolveProposalsBatch({ items, services });

  let committed = 0;
  let needsReview = 0;
  let failed = 0;

  for (const item of resolved.items) {
    const proposal = await getProposalById(item.proposalId);
    if (!proposal || proposal.status === "committed" || proposal.status === "superseded") {
      if (proposal?.status === "committed") committed += 1;
      continue;
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
      if (policy.decision === "no_proposal") failed += 1;
      else needsReview += 1;
      continue;
    }

    try {
      await runInDbTransaction(async () => {
        const result = await applyProposalPolicy({
          plan: item.plan,
          policy,
          services,
          submissionId: ctx.submissionId,
          extractionVersion: ctx.extractionVersion,
          proposalKey: proposal.proposalKey,
          sourceProposalId: proposal.id,
        });
        if (!result.committed) {
          throw new Error(result.commitError ?? "Transition commit failed.");
        }
        await upsertTransitionCommit({
          submissionId: ctx.submissionId,
          extractionVersion: ctx.extractionVersion,
          proposalKey: proposal.proposalKey,
          status: "committed",
          fromTrackId: result.fromTrackId,
          toTrackId: result.toTrackId,
          payload: {
            decision: result.decision,
            importedTrackIds: result.importedTrackIds,
            bidirectional: Boolean(item.plan.bidirectional),
            transitionId: result.transitionId,
          },
        });
        if (item.plan.bidirectional && result.fromTrackId && result.toTrackId) {
          await upsertTransitionCommit({
            submissionId: ctx.submissionId,
            extractionVersion: ctx.extractionVersion,
            proposalKey: `${proposal.proposalKey}:rev`,
            status: "committed",
            fromTrackId: result.toTrackId,
            toTrackId: result.fromTrackId,
            payload: {
              decision: result.decision,
              reverseOf: proposal.proposalKey,
              transitionId: result.reverseTransitionId,
            },
          });
        }
        await updateProposal(proposal.id, {
          status: "committed",
          error: null,
          policyResult: {
            ...policy,
            reviewReasons,
            applied: result,
          } as unknown as Record<string, unknown>,
        });
      });
      committed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transition commit failed.";
      await upsertTransitionCommit({
        submissionId: ctx.submissionId,
        extractionVersion: ctx.extractionVersion,
        proposalKey: proposal.proposalKey,
        status: "commit_failed",
        error: message,
      });
      await updateProposal(proposal.id, {
        status: "failed",
        error: message,
      });
      failed += 1;
    }
  }

  return {
    proposalCount: ready.length,
    committed,
    needsReview,
    failed,
  };
}

export async function finalizeSubmission(
  ctx: OrchestratorContext,
  orchestrator: {
    toolCallCount: number;
    stepCount: number;
    model: string;
    dispatchLimitHit: boolean;
  },
  applySummary: ApplySummary,
): Promise<void> {
  "use step";

  const counts = await countProposalsForVersion(ctx.submissionId, ctx.extractionVersion);
  let extractionStatus = deriveSubmissionExtractionStatus(counts);
  let extractionError: string | null = null;

  if (orchestrator.dispatchLimitHit) {
    extractionError = `Hard dispatch limit hit (${SUBMISSION_LIMITS.maxTransitions} transitions). Extra spans were not processed.`;
    if (counts.committed > 0) {
      extractionStatus = "partially_committed";
    } else if (extractionStatus === "no_proposal") {
      extractionStatus = "failed";
    }
  }

  const proposals = await listProposalsForVersion(ctx.submissionId, ctx.extractionVersion);
  const extractionPayload: Record<string, unknown> = {
    pipeline: "durable-multi-transition",
    limits: SUBMISSION_LIMITS,
    counts,
    applySummary,
    dispatchLimitHit: orchestrator.dispatchLimitHit,
    proposals: proposals.map(summarizeProposal),
    agent: {
      name: ORCHESTRATOR_AGENT_NAME,
      runId: ctx.agentRunId,
      workflowRunId: ctx.workflowRunId,
      stepCount: orchestrator.stepCount,
      toolCallCount: orchestrator.toolCallCount,
      promptVersion: ORCHESTRATOR_PROMPT_VERSION,
    },
  };

  await finishAgentRun(ctx.agentRunId, {
    status: extractionStatus === "failed" && counts.committed === 0 ? "failed" : "completed",
    stepCount: orchestrator.stepCount,
    toolCallCount: orchestrator.toolCallCount,
    model: orchestrator.model,
    promptVersion: ORCHESTRATOR_PROMPT_VERSION,
    toolSummary: {
      proposalCount: counts.total,
      committed: counts.committed,
      needsReview: counts.needs_review,
      failed: counts.failed,
      dispatchLimitHit: orchestrator.dispatchLimitHit,
    },
    policyResult: {
      counts,
      applySummary,
    },
    plan: { proposalKeys: proposals.map((p) => p.proposalKey) },
    error: extractionError,
  });

  if (extractionStatus === "failed" && counts.committed === 0 && applySummary.proposalCount === 0) {
    await failExtraction(
      ctx.submissionId,
      ctx.extractionVersion,
      extractionError ?? "No transition proposals were produced.",
    );
    return;
  }

  const confidence =
    proposals
      .map((p) => {
        const draft = p.draft as { confidence?: ConfidenceLevel } | null;
        const level = draft?.confidence;
        return level ? confidenceToUnitInterval(level) : null;
      })
      .filter((value): value is number => value != null)
      .reduce((sum, value, _, arr) => sum + value / arr.length, 0) || 0;

  await completeExtraction(ctx.submissionId, ctx.extractionVersion, {
    extraction: extractionPayload,
    rawResponse: {
      workflowRunId: ctx.workflowRunId,
      toolCallCount: orchestrator.toolCallCount,
      stepCount: orchestrator.stepCount,
      dispatchLimitHit: orchestrator.dispatchLimitHit,
    },
    model: orchestrator.model,
    provider: orchestrator.model.includes("/") ? orchestrator.model.split("/")[0]! : "unknown",
    promptVersion: ORCHESTRATOR_PROMPT_VERSION,
    extractionConfidence: confidence,
    extractionStatus: extractionStatus as
      | "no_proposal"
      | "needs_review"
      | "committed"
      | "partially_committed"
      | "commit_failed"
      | "resolving"
      | "failed",
  });

  console.log(
    `[submission-workflow] finalize submission=${ctx.submissionId} status=${extractionStatus} committed=${counts.committed}`,
  );
}

function summarizeProposal(proposal: SubmissionProposal): Record<string, unknown> {
  const draft = proposal.draft as {
    confidence?: string;
    bidirectional?: boolean;
    ambiguities?: string[];
    mentions?: Array<{
      mentionId?: string;
      mention?: string;
      titleHint?: string | null;
      artistHint?: string | null;
    }>;
    transition?: {
      fromMentionId?: string;
      toMentionId?: string;
      fromBar?: number | null;
      toBar?: number | null;
      barsOverlap?: number | null;
      technique?: string | null;
      intent?: string | null;
      quality?: string | null;
      notes?: string | null;
    };
  } | null;
  const policyResult = proposal.policyResult as {
    decision?: string;
    reviewReasons?: unknown;
    applied?: {
      committed?: boolean;
      fromTrackId?: string | null;
      toTrackId?: string | null;
      commitError?: string | null;
    };
  } | null;
  const resolution = proposal.resolution as {
    plan?: {
      confidence?: string;
      bidirectional?: boolean;
      ambiguities?: string[];
      mentions?: Array<{
        mentionId?: string;
        mention?: string;
        titleHint?: string | null;
        artistHint?: string | null;
        resolutionStatus?: string;
        selectedCandidateId?: string | null;
      }>;
      transitions?: Array<{
        fromMentionId?: string;
        toMentionId?: string;
        fromBar?: number | null;
        toBar?: number | null;
        barsOverlap?: number | null;
        technique?: string | null;
        intent?: string | null;
        quality?: string | null;
        notes?: string | null;
      }>;
    };
  } | null;

  const plan = resolution?.plan;
  const transition = plan?.transitions?.[0] ?? draft?.transition ?? null;
  const mentions = plan?.mentions ?? draft?.mentions ?? [];
  const confidence = plan?.confidence ?? draft?.confidence ?? null;
  const bidirectional = plan?.bidirectional ?? draft?.bidirectional ?? false;

  return {
    id: proposal.id,
    proposalKey: proposal.proposalKey,
    status: proposal.status,
    sourceStart: proposal.sourceStart,
    sourceEnd: proposal.sourceEnd,
    sourceText: proposal.sourceText,
    sourceFingerprint: proposal.sourceFingerprint,
    confidence,
    bidirectional,
    ambiguities: plan?.ambiguities ?? draft?.ambiguities ?? [],
    mentions: mentions.map((mention) => ({
      mentionId: mention.mentionId ?? null,
      mention: mention.mention ?? null,
      titleHint: mention.titleHint ?? null,
      artistHint: mention.artistHint ?? null,
      resolutionStatus: "resolutionStatus" in mention ? (mention.resolutionStatus ?? null) : null,
      selectedCandidateId:
        "selectedCandidateId" in mention ? (mention.selectedCandidateId ?? null) : null,
    })),
    transition,
    decision: policyResult?.decision ?? null,
    committed: policyResult?.applied?.committed ?? proposal.status === "committed",
    fromTrackId: policyResult?.applied?.fromTrackId ?? null,
    toTrackId: policyResult?.applied?.toTrackId ?? null,
    commitError: policyResult?.applied?.commitError ?? null,
    error: proposal.error,
    reviewReasons: policyResult?.reviewReasons ?? null,
    attemptCount: proposal.attemptCount,
    model: proposal.model,
    promptVersion: proposal.promptVersion,
  };
}

export async function failWorkflow(
  submissionId: string,
  extractionVersion: number,
  agentRunId: string | null,
  message: string,
): Promise<void> {
  "use step";
  console.error(`[submission-workflow] fail submission=${submissionId}: ${message}`);
  if (agentRunId) {
    await finishAgentRun(agentRunId, { status: "failed", error: message });
  }
  await failExtraction(submissionId, extractionVersion, message);
}

export async function countProposalsStep(
  submissionId: string,
  extractionVersion: number,
): Promise<{ total: number }> {
  "use step";
  const counts = await countProposalsForVersion(submissionId, extractionVersion);
  return { total: counts.total };
}
