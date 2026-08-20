import { start } from "workflow/api";

/**
 * Launch the durable submission workflow and return its run id.
 *
 * The workflow module is loaded lazily so GET /notes (list submissions) does not
 * compile `"use workflow"` files or the @workflow/next Turbopack loader.
 */
export async function startSubmissionWorkflow(
  noteId: string,
  extractionVersion: number,
): Promise<{ workflowRunId: string }> {
  const { processSubmissionWorkflow } = await import("@/workflows/process-submission");
  const run = await start(processSubmissionWorkflow, [{ noteId, extractionVersion }]);
  return { workflowRunId: run.runId };
}
