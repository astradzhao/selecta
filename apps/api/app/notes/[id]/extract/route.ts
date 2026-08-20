import { NextResponse } from "next/server";
import { isNotesError, isPostgresConfigured, requeueExtraction } from "@selecta/db";

import { loadSerializedTrackLinks, serializeNote } from "@/lib/notes";

/** Durable workflow continues after the retry response. */
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Retry / re-run extraction for the current note version (idempotent queue).
 * POST /notes/:id/extract
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
      { ok: false, error: "invalid_id", message: "Note id is required." },
      { status: 400 },
    );
  }

  try {
    const note = await requeueExtraction(id);
    const { startSubmissionWorkflow } = await import("@/lib/start-submission-workflow");
    const { workflowRunId } = await startSubmissionWorkflow(note.id, note.extractionVersion);
    const trackLinks = await loadSerializedTrackLinks(note.id);
    return NextResponse.json({
      ok: true,
      note: serializeNote(note, trackLinks),
      workflowRunId,
    });
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("requeue note extraction failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to requeue extraction." },
      { status: 500 },
    );
  }
}
