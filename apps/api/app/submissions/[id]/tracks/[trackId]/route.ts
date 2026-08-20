import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@selecta/db";
import {
  getSubmissionById,
  isSubmissionsError,
  removeSubmissionTrackLink,
} from "@selecta/submissions";

import { loadSerializedTrackLinks, serializeSubmission } from "@/lib/submissions";

type RouteContext = {
  params: Promise<{ id: string; trackId: string }>;
};

/**
 * Remove a manual submission → track link.
 * DELETE /submissions/:id/tracks/:trackId
 */
export async function DELETE(_request: Request, context: RouteContext) {
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

  const { id, trackId } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Submission id is required." },
      { status: 400 },
    );
  }
  if (!trackId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Track id is required." },
      { status: 400 },
    );
  }

  try {
    await removeSubmissionTrackLink(id, decodeURIComponent(trackId));
    const submission = await getSubmissionById(id);
    const trackLinks = submission ? await loadSerializedTrackLinks(submission.id) : [];
    return NextResponse.json({
      ok: true,
      trackLinks,
      ...(submission ? { submission: serializeSubmission(submission, trackLinks) } : {}),
    });
  } catch (error) {
    if (isSubmissionsError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("remove submission track link failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to unlink track from submission." },
      { status: 500 },
    );
  }
}
