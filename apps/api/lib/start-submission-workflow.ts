import { start } from "workflow/api";

import { processSubmissionWorkflow } from "@/workflows/process-submission";

/**
 * Launch the durable submission workflow and return its run id.
 * Replaces Next.js `after(runNoteExtraction)` (same-invocation background work).
 */
export async function startSubmissionWorkflow(
  noteId: string,
  extractionVersion: number,
): Promise<{ workflowRunId: string }> {
  const run = await start(processSubmissionWorkflow, [{ noteId, extractionVersion }]);
  return { workflowRunId: run.runId };
}
