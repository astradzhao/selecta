import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, getWorkflowMetadata } from "workflow";
import { z } from "zod";

import {
  beginOrchestration,
  countProposalsStep,
  failWorkflow,
  finalizeSubmission,
  parseSingleTransitionTool,
  resolveAndApplyProposals,
  resolveOrchestratorConfig,
  type ProcessSubmissionInput,
} from "./process-submission.steps";

export type { ProcessSubmissionInput } from "./process-submission.steps";

/**
 * Durable multi-transition submission workflow (DJ-66).
 * Sandbox-only orchestration — Node-dependent work lives in process-submission.steps.ts.
 */
export async function processSubmissionWorkflow(input: ProcessSubmissionInput) {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const ctx = await beginOrchestration({ ...input, workflowRunId });
  if (!ctx) {
    return { skipped: true as const };
  }

  try {
    const config = await resolveOrchestratorConfig(ctx);

    const agent = new DurableAgent({
      model: config.model,
      instructions: config.systemPrompt,
      tools: {
        parse_single_transition: {
          description:
            "Parse exactly one transition from a source span. Returns only {ok, proposalId, retryable}.",
          inputSchema: z.object({
            submissionId: z.string(),
            extractionVersion: z.number().int().nonnegative(),
            sourceStart: z.number().int().nonnegative(),
            sourceEnd: z.number().int().nonnegative(),
            sourceText: z.string().min(1),
            sourceFingerprint: z.string().optional(),
          }),
          execute: async (toolInput: {
            submissionId: string;
            extractionVersion: number;
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
            }),
        },
      },
    });

    const streamResult = await agent.stream({
      messages: [
        {
          role: "user",
          content: config.userPrompt,
        },
      ],
      writable: getWritable(),
      maxSteps: config.maxSteps,
      maxOutputTokens: 1_200,
    });

    const applySummary = await resolveAndApplyProposals(ctx);
    const counts = await countProposalsStep(ctx.noteId, ctx.extractionVersion);
    const orchestrator = {
      toolCallCount: counts.total,
      stepCount: streamResult.steps?.length ?? 0,
      model: config.model,
      dispatchLimitHit: counts.total >= config.maxTransitions,
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
