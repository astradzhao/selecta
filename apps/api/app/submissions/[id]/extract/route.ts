import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@selecta/db";
import { isSubmissionsError, requeueExtraction } from "@selecta/submissions";

import { loadSerializedTrackLinks, serializeSubmission } from "@/lib/submissions";

/** Durable workflow continues after the retry response. */
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Retry / re-run extraction for the current submission version (idempotent queue).
 * POST /submissions/:id/extract
 */
export async function POST(_request: Request, context: RouteContext) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_not_configured",
        message: "Postgres is not configured.",
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Submission id is required." },
      { status: 400 },
    );
  }

  try {
    const submission = await requeueExtraction(id);
    const { startSubmissionWorkflow } = await import("@/lib/start-submission-workflow");
    const { workflowRunId } = await startSubmissionWorkflow(
      submission.id,
      submission.extractionVersion,
    );
    const trackLinks = await loadSerializedTrackLinks(submission.id);
    return NextResponse.json({
      ok: true,
      submission: serializeSubmission(submission, trackLinks),
      workflowRunId,
    });
  } catch (error) {
    if (isSubmissionsError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("requeue submission extraction failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to requeue extraction." },
      { status: 500 },
    );
  }
}
