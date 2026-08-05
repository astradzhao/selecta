import {
  completeExtraction,
  failExtraction,
  finishAgentRun,
  getNoteById,
  isPostgresConfigured,
  startAgentRun,
  upsertTransitionCommit,
} from "@selecta/db";
import {
  applyNoteProcessingPolicy,
  evaluateNoteProcessingPolicy,
  NOTE_AGENT_NAME,
  runNoteAgent,
  validateNoteProcessingPlan,
} from "@selecta/mix-notes";
import { createAgentLogger } from "@selecta/agentics";

import { createNoteAgentServices } from "./note-agent-services";

function hasAiGatewayAuth(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    process.env.AWS_ROLE_ARN ||
    process.env.VERCEL,
  );
}

/**
 * Cheap note pipeline for a note version:
 * one-shot LLM draft → deterministic library/Spotify resolve → policy import/commit.
 * Never throws to the caller — failures are written onto the note / agent-run rows.
 */
export async function runNoteExtraction(noteId: string, version: number): Promise<void> {
  if (!isPostgresConfigured()) {
    return;
  }

  const note = await getNoteById(noteId);
  if (!note) {
    return;
  }
  if (note.extractionVersion !== version || note.extractionStatus !== "extracting") {
    return;
  }

  if (!hasAiGatewayAuth()) {
    await failExtraction(
      noteId,
      version,
      "AI Gateway auth is not configured (set AI_GATEWAY_API_KEY locally, or use Vercel OIDC when deployed).",
    );
    return;
  }

  const logger = createAgentLogger();
  const services = createNoteAgentServices();
  const agentRun = await startAgentRun({
    noteId,
    extractionVersion: version,
    agentName: NOTE_AGENT_NAME,
  });

  logger.log("info", {
    type: "coordinator",
    runId: agentRun.id,
    noteId,
    extractionVersion: version,
    phase: "start",
    detail: `rawTextChars=${note.rawText.length}`,
  });

  try {
    const agentResult = await runNoteAgent({
      rawText: note.rawText,
      services,
      runId: agentRun.id,
      meta: { noteId, extractionVersion: version },
      logger,
    });

    if (!agentResult.ok) {
      logger.log("error", {
        type: "coordinator",
        runId: agentRun.id,
        noteId,
        extractionVersion: version,
        phase: "agent_failed",
        detail: `${agentResult.error.code}: ${agentResult.error.message}`,
      });
      await finishAgentRun(agentRun.id, {
        status: "failed",
        stepCount: agentResult.stepCount,
        toolCallCount: agentResult.toolCallCount,
        usage: null,
        error: agentResult.error.message,
        model: agentResult.model,
        provider: agentResult.provider,
        promptVersion: agentResult.promptVersion,
        promptHash: agentResult.promptHash,
      });
      await failExtraction(noteId, version, agentResult.error.message);
      return;
    }

    const validation = validateNoteProcessingPlan({
      plan: agentResult.plan,
      candidatesByHandle: agentResult.candidates.byHandle,
      expectedExtractionVersion: version,
      actualExtractionVersion: note.extractionVersion,
    });

    if (!validation.ok) {
      const message = validation.issues.map((issue) => issue.message).join(" | ");
      logger.log("error", {
        type: "coordinator",
        runId: agentRun.id,
        noteId,
        extractionVersion: version,
        phase: "validation_failed",
        detail: message,
      });
      await finishAgentRun(agentRun.id, {
        status: "failed",
        stepCount: agentResult.stepCount,
        toolCallCount: agentResult.toolCallCount,
        usage: agentResult.usage as Record<string, unknown> | undefined,
        plan: agentResult.plan as unknown as Record<string, unknown>,
        toolSummary: {
          candidateCount: agentResult.candidates.byHandle.size,
        },
        error: message,
        model: agentResult.model,
        provider: agentResult.provider,
        promptVersion: agentResult.promptVersion,
        promptHash: agentResult.promptHash,
      });
      await failExtraction(noteId, version, message);
      return;
    }

    const policy = evaluateNoteProcessingPolicy({
      plan: agentResult.plan,
      candidatesByHandle: agentResult.candidates.byHandle,
      candidatesByMentionId: agentResult.candidates.byMentionId,
    });

    logger.log("info", {
      type: "policy",
      runId: agentRun.id,
      decision: policy.decision,
      reasons: policy.reasons.map((reason) => `${reason.code}:${reason.message}`),
    });

    const applied = await applyNoteProcessingPolicy({
      plan: agentResult.plan,
      policy,
      services,
      noteId,
      extractionVersion: version,
    });

    for (const key of applied.committedProposalKeys) {
      const commit = policy.commits.find(
        (item) => `${noteId}:${version}:${item.transitionIndex}` === key,
      );
      await upsertTransitionCommit({
        noteId,
        extractionVersion: version,
        proposalKey: key,
        status: "committed",
        fromTrackId: commit ? applied.resolvedTrackIdsByMention[commit.fromMentionId] : null,
        toTrackId: commit ? applied.resolvedTrackIdsByMention[commit.toMentionId] : null,
        payload: { decision: applied.decision },
      });
    }

    for (const failure of applied.failedProposalKeys) {
      await upsertTransitionCommit({
        noteId,
        extractionVersion: version,
        proposalKey: failure.proposalKey,
        status: "commit_failed",
        error: failure.error,
      });
    }

    const reviewReasons = applied.reasons
      .filter((reason) => reason.code !== "ok")
      .map((reason) => ({ code: reason.code, message: reason.message }));

    const extractionPayload: Record<string, unknown> = {
      plan: agentResult.plan,
      policy: {
        decision: applied.decision,
        reasons: applied.reasons,
        resolvedTrackIdsByMention: applied.resolvedTrackIdsByMention,
      },
      reviewReasons,
      importedTrackIds: applied.importedTrackIds,
      committedProposalKeys: applied.committedProposalKeys,
      agent: {
        name: NOTE_AGENT_NAME,
        runId: agentRun.id,
        stepCount: agentResult.stepCount,
        toolCallCount: agentResult.toolCallCount,
        promptHash: agentResult.promptHash,
      },
    };

    let extractionStatus: "no_proposal" | "needs_review" | "committed" | "commit_failed";
    let noteStatus: "draft" | "preview" | "committed";

    if (applied.decision === "no_proposal") {
      extractionStatus = "no_proposal";
      noteStatus = "draft";
    } else if (applied.decision === "auto_commit" && applied.failedProposalKeys.length === 0) {
      extractionStatus = "committed";
      noteStatus = "committed";
    } else if (applied.failedProposalKeys.length > 0) {
      extractionStatus = "commit_failed";
      noteStatus = "preview";
    } else {
      extractionStatus = "needs_review";
      noteStatus = "preview";
    }

    await finishAgentRun(agentRun.id, {
      status: "completed",
      stepCount: agentResult.stepCount,
      toolCallCount: agentResult.toolCallCount,
      usage: (agentResult.usage as Record<string, unknown> | undefined) ?? null,
      toolSummary: {
        candidateCount: agentResult.candidates.byHandle.size,
        mentionCandidateGroups: agentResult.candidates.byMentionId.size,
      },
      plan: agentResult.plan as unknown as Record<string, unknown>,
      policyResult: {
        decision: applied.decision,
        reasons: applied.reasons,
        importedTrackIds: applied.importedTrackIds,
        committedProposalKeys: applied.committedProposalKeys,
      },
      model: agentResult.model,
      provider: agentResult.provider,
      promptVersion: agentResult.promptVersion,
      promptHash: agentResult.promptHash,
    });

    await completeExtraction(noteId, version, {
      extraction: extractionPayload,
      rawResponse: {
        finishReason: agentResult.finishReason,
        usage: agentResult.usage,
        stepCount: agentResult.stepCount,
        toolCallCount: agentResult.toolCallCount,
      },
      model: agentResult.model,
      provider: agentResult.provider,
      promptVersion: agentResult.promptVersion,
      extractionConfidence: agentResult.plan.confidence,
      extractionStatus,
      status: noteStatus,
    });

    logger.log("info", {
      type: "coordinator",
      runId: agentRun.id,
      noteId,
      extractionVersion: version,
      phase: "complete",
      detail: `extractionStatus=${extractionStatus} decision=${applied.decision}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Note agent failed unexpectedly.";
    console.error(`note agent failed for ${noteId}@${version}`, error);
    logger.log("error", {
      type: "coordinator",
      runId: agentRun.id,
      noteId,
      extractionVersion: version,
      phase: "exception",
      detail: message,
    });
    await finishAgentRun(agentRun.id, {
      status: "failed",
      error: message,
    });
    await failExtraction(noteId, version, message);
  }
}
