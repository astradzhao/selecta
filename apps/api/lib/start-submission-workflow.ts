import { start } from "workflow/api";

import { processSubmissionWorkflow } from "@/workflows/process-submission";

/**
 * Launch the durable submission workflow and return its run id.
 */
export async function startSubmissionWorkflow(
  noteId: string,
  extractionVersion: number,
): Promise<{ workflowRunId: string }> {
  const run = await start(processSubmissionWorkflow, [{ noteId, extractionVersion }]);
  return { workflowRunId: run.runId };
}
