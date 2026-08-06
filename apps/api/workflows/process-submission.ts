import { DurableAgent } from "@workflow/ai/agent";
import {
  applyProposalPolicy,
  buildOrchestratorPrompt,
  buildOrchestratorUserPrompt,
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
  type ParseSingleTransitionReceipt,
  type SingleTransitionDraft,
} from "@selecta/mix-notes";
import {
  claimProposal,
  completeExtraction,
  countProposalsForVersion,
  deriveSubmissionExtractionStatus,
  failExtraction,
  finishAgentRun,
  getNoteById,
  getProposalById,
  isPostgresConfigured,
  listProposalsForVersion,
  startAgentRun,
  updateProposal,
  upsertTransitionCommit,
  type NoteProposal,
} from "@selecta/db";
import { FatalError, RetryableError, getWritable, getWorkflowMetadata } from "workflow";
import { z } from "zod";

import { createNoteAgentServices } from "@/lib/note-agent-services";

export type ProcessSubmissionInput = {
  noteId: string;
  extractionVersion: number;
};

function hasAiGatewayAuth(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    process.env.AWS_ROLE_ARN ||
    process.env.VERCEL,
  );
}

type OrchestratorContext = {
  noteId: string;
  extractionVersion: number;
  agentRunId: string;
  workflowRunId: string;
  rawText: string;
};

async function beginOrchestration(
  input: ProcessSubmissionInput & { workflowRunId: string },
): Promise<OrchestratorContext | null> {
  "use step";

  console.log(
    `[submission-workflow] begin note=${input.noteId} version=${input.extractionVersion} run=${input.workflowRunId}`,
  );

  if (!isPostgresConfigured()) {
    return null;
  }

  const note = await getNoteById(input.noteId);
  if (!note) {
    return null;
  }
  if (
    note.extractionVersion !== input.extractionVersion ||
    note.extractionStatus !== "extracting"
  ) {
    console.log(
      `[submission-workflow] skip stale note=${input.noteId} version=${input.extractionVersion} status=${note.extractionStatus}`,
    );
    return null;
  }

  if (!hasAiGatewayAuth()) {
    await failExtraction(
      input.noteId,
      input.extractionVersion,
      "AI Gateway auth is not configured (set AI_GATEWAY_API_KEY locally, or use Vercel OIDC when deployed).",
    );
    throw new FatalError("AI Gateway auth is not configured.");
  }

  const agentRun = await startAgentRun({
    noteId: input.noteId,
    extractionVersion: input.extractionVersion,
    agentName: ORCHESTRATOR_AGENT_NAME,
    workflowRunId: input.workflowRunId,
    promptVersion: ORCHESTRATOR_PROMPT_VERSION,
  });

  return {
    noteId: input.noteId,
    extractionVersion: input.extractionVersion,
    agentRunId: agentRun.id,
    workflowRunId: input.workflowRunId,
    rawText: note.rawText,
  };
}

/**
 * Child parse tool: one cheap structured-output call + Postgres proposal persistence.
 * Returns only a minimal receipt to the parent orchestrator.
 */
async function parseSingleTransitionTool(rawInput: {
  submissionId: string;
  extractionVersion: number;
  ordinal: number;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
  sourceFingerprint?: string;
  agentRunId: string;
  workflowRunId: string;
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

  const { submissionId, extractionVersion, ordinal, sourceStart, sourceEnd, sourceText } =
    parsedInput.data;

  if (ordinal >= SUBMISSION_LIMITS.maxTransitions) {
    const message = `Dispatch limit exceeded (ordinal ${ordinal} >= ${SUBMISSION_LIMITS.maxTransitions}).`;
    console.error(`[submission-workflow] ${message}`);
    return { ok: false, proposalId: null, retryable: false, error: message };
  }

  if (sourceEnd < sourceStart || sourceText.length === 0) {
    return {
      ok: false,
      proposalId: null,
      retryable: false,
      error: "Invalid source span.",
    };
  }

  const fingerprint =
    parsedInput.data.sourceFingerprint?.trim() ||
    sourceFingerprint(sourceStart, sourceEnd, sourceText);
  const proposalKey = spanProposalKey(submissionId, extractionVersion, fingerprint);

  const claimed = await claimProposal({
    noteId: submissionId,
    extractionVersion,
    workflowRunId: rawInput.workflowRunId,
    agentRunId: rawInput.agentRunId,
    ordinal,
    sourceStart,
    sourceEnd,
    sourceText,
    sourceFingerprint: fingerprint,
    proposalKey,
  });

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

  console.log(
    `[submission-workflow] parsed proposal=${claimed.proposal.id} ordinal=${ordinal} key=${proposalKey}`,
  );

  return { ok: true, proposalId: claimed.proposal.id, retryable: false, error: null };
}

async function resolveAndApplyProposals(ctx: OrchestratorContext): Promise<{
  proposalCount: number;
  committed: number;
  needsReview: number;
  failed: number;
}> {
  "use step";

  console.log(
    `[submission-workflow] resolve/apply note=${ctx.noteId} version=${ctx.extractionVersion}`,
  );

  const proposals = await listProposalsForVersion(ctx.noteId, ctx.extractionVersion);
  const ready = proposals.filter(
    (proposal) =>
      proposal.status === "ready" ||
      proposal.status === "resolving" ||
      (proposal.status === "needs_review" && proposal.draft),
  );

  if (ready.length === 0) {
    return { proposalCount: 0, committed: 0, needsReview: 0, failed: 0 };
  }

  const services = createNoteAgentServices();
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

    if (proposal.transitionId) {
      await updateProposal(proposal.id, { status: "committed", error: null });
      committed += 1;
      continue;
    }

    const policy = evaluateProposalPolicy({
      plan: item.plan,
      candidatesByHandle: item.candidatesByHandle,
      candidatesByMentionId: item.candidatesByMentionId,
    });

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
      policyResult: policy as unknown as Record<string, unknown>,
      reviewReasons: policy.reasons.filter((reason) => reason.code !== "ok") as unknown as Array<
        Record<string, unknown>
      >,
    });

    if (policy.decision !== "auto_commit") {
      await updateProposal(proposal.id, {
        status: policy.decision === "no_proposal" ? "failed" : "needs_review",
      });
      if (policy.decision === "no_proposal") failed += 1;
      else needsReview += 1;
      continue;
    }

    const applied = await applyProposalPolicy({
      plan: item.plan,
      policy,
      services,
      noteId: ctx.noteId,
      extractionVersion: ctx.extractionVersion,
      proposalKey: proposal.proposalKey,
    });

    if (applied.committed) {
      await upsertTransitionCommit({
        noteId: ctx.noteId,
        extractionVersion: ctx.extractionVersion,
        proposalKey: proposal.proposalKey,
        status: "committed",
        fromTrackId: applied.fromTrackId,
        toTrackId: applied.toTrackId,
        payload: {
          decision: applied.decision,
          importedTrackIds: applied.importedTrackIds,
        },
      });
      await updateProposal(proposal.id, {
        status: "committed",
        transitionId: proposal.proposalKey,
        error: null,
        policyResult: {
          ...policy,
          applied,
        } as unknown as Record<string, unknown>,
      });
      committed += 1;
    } else if (applied.commitError) {
      await upsertTransitionCommit({
        noteId: ctx.noteId,
        extractionVersion: ctx.extractionVersion,
        proposalKey: proposal.proposalKey,
        status: "commit_failed",
        fromTrackId: applied.fromTrackId,
        toTrackId: applied.toTrackId,
        error: applied.commitError,
      });
      await updateProposal(proposal.id, {
        status: "failed",
        error: applied.commitError,
      });
      failed += 1;
    } else {
      await updateProposal(proposal.id, {
        status: "needs_review",
        policyResult: {
          ...policy,
          applied,
        } as unknown as Record<string, unknown>,
      });
      needsReview += 1;
    }
  }

  return {
    proposalCount: ready.length,
    committed,
    needsReview,
    failed,
  };
}

async function finalizeSubmission(
  ctx: OrchestratorContext,
  orchestrator: {
    toolCallCount: number;
    stepCount: number;
    model: string;
    dispatchLimitHit: boolean;
  },
  applySummary: {
    proposalCount: number;
    committed: number;
    needsReview: number;
    failed: number;
  },
): Promise<void> {
  "use step";

  const counts = await countProposalsForVersion(ctx.noteId, ctx.extractionVersion);
  const derived = deriveSubmissionExtractionStatus(counts);

  let extractionStatus = derived.extractionStatus;
  let noteStatus = derived.noteStatus;
  let extractionError: string | null = null;

  if (orchestrator.dispatchLimitHit) {
    extractionError = `Hard dispatch limit hit (${SUBMISSION_LIMITS.maxTransitions} transitions). Extra spans were not processed.`;
    if (counts.committed > 0) {
      extractionStatus = "partially_committed";
      noteStatus = "preview";
    } else if (extractionStatus === "no_proposal") {
      extractionStatus = "failed";
      noteStatus = "draft";
    }
  }

  const proposals = await listProposalsForVersion(ctx.noteId, ctx.extractionVersion);
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
      ctx.noteId,
      ctx.extractionVersion,
      extractionError ?? "No transition proposals were produced.",
    );
    return;
  }

  const confidence =
    proposals
      .map((p) => {
        const draft = p.draft as { confidence?: number } | null;
        return typeof draft?.confidence === "number" ? draft.confidence : null;
      })
      .filter((value): value is number => value != null)
      .reduce((sum, value, _, arr) => sum + value / arr.length, 0) || 0;

  await completeExtraction(ctx.noteId, ctx.extractionVersion, {
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
    status: noteStatus,
  });

  console.log(
    `[submission-workflow] finalize note=${ctx.noteId} status=${extractionStatus} committed=${counts.committed}`,
  );
}

function summarizeProposal(proposal: NoteProposal): Record<string, unknown> {
  return {
    id: proposal.id,
    proposalKey: proposal.proposalKey,
    ordinal: proposal.ordinal,
    status: proposal.status,
    sourceStart: proposal.sourceStart,
    sourceEnd: proposal.sourceEnd,
    sourceFingerprint: proposal.sourceFingerprint,
    transitionId: proposal.transitionId,
    error: proposal.error,
    reviewReasons: proposal.reviewReasons,
  };
}

async function failWorkflow(
  noteId: string,
  extractionVersion: number,
  agentRunId: string | null,
  message: string,
): Promise<void> {
  "use step";
  console.error(`[submission-workflow] fail note=${noteId}: ${message}`);
  if (agentRunId) {
    await finishAgentRun(agentRunId, { status: "failed", error: message });
  }
  await failExtraction(noteId, extractionVersion, message);
}

/**
 * Durable multi-transition submission workflow (DJ-66).
 * Persist → orchestrate span discovery → per-span parse → batched resolve → partial commits.
 */
async function resolveOrchestratorModel(): Promise<string> {
  "use step";
  return (
    process.env.NOTE_ORCHESTRATOR_MODEL?.trim() ||
    process.env.NOTE_AGENT_MODEL?.trim() ||
    DEFAULT_ORCHESTRATOR_MODEL
  );
}

/**
 * Durable multi-transition submission workflow (DJ-66).
 * Persist → orchestrate span discovery → per-span parse → batched resolve → partial commits.
 */
export async function processSubmissionWorkflow(input: ProcessSubmissionInput) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const ctx = await beginOrchestration({ ...input, workflowRunId });
  if (!ctx) {
    return { skipped: true as const };
  }

  try {
    const model = await resolveOrchestratorModel();
    const prompt = buildOrchestratorPrompt(SUBMISSION_LIMITS.maxTransitions);

    const agent = new DurableAgent({
      model,
      instructions: prompt.system,
      tools: {
        parse_single_transition: {
          description:
            "Parse exactly one transition from a source span. Returns only {ok, proposalId, retryable}.",
          inputSchema: z.object({
            submissionId: z.string(),
            extractionVersion: z.number().int().nonnegative(),
            ordinal: z.number().int().nonnegative(),
            sourceStart: z.number().int().nonnegative(),
            sourceEnd: z.number().int().nonnegative(),
            sourceText: z.string().min(1),
            sourceFingerprint: z.string().optional(),
          }),
          execute: async (toolInput: {
            submissionId: string;
            extractionVersion: number;
            ordinal: number;
            sourceStart: number;
            sourceEnd: number;
            sourceText: string;
            sourceFingerprint?: string;
          }) =>
            parseSingleTransitionTool({
              ...toolInput,
              submissionId: ctx.noteId,
              extractionVersion: ctx.extractionVersion,
              agentRunId: ctx.agentRunId,
              workflowRunId: ctx.workflowRunId,
            }),
        },
      },
    });

    const streamResult = await agent.stream({
      messages: [
        {
          role: "user",
          content: buildOrchestratorUserPrompt(ctx.rawText, {
            submissionId: ctx.noteId,
            extractionVersion: ctx.extractionVersion,
          }),
        },
      ],
      writable: getWritable(),
      maxSteps: SUBMISSION_LIMITS.maxOrchestrationSteps,
      maxOutputTokens: 1_200,
    });

    const applySummary = await resolveAndApplyProposals(ctx);
    const counts = await countProposalsStep(ctx.noteId, ctx.extractionVersion);
    const orchestrator = {
      toolCallCount: counts.total,
      stepCount: streamResult.steps?.length ?? 0,
      model,
      dispatchLimitHit: counts.total >= SUBMISSION_LIMITS.maxTransitions,
    };

    await finalizeSubmission(ctx, orchestrator, applySummary);
    return {
      skipped: false as const,
      workflowRunId: ctx.workflowRunId,
      ...applySummary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submission workflow failed.";
    await failWorkflow(ctx.noteId, ctx.extractionVersion, ctx.agentRunId, message);
    throw error;
  }
}

async function countProposalsStep(
  noteId: string,
  extractionVersion: number,
): Promise<{ total: number }> {
  "use step";
  const counts = await countProposalsForVersion(noteId, extractionVersion);
  return { total: counts.total };
}
