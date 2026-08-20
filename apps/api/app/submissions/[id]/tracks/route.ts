import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@selecta/db";
import { getTrackById } from "@selecta/library";
import {
  addSubmissionTrackLink,
  getSubmissionById,
  isSubmissionsError,
} from "@selecta/submissions";

import {
  loadSerializedTrackLinks,
  serializeSubmission,
  serializeSubmissionTrackLink,
} from "@/lib/submissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): { trackId: string; role?: string | null } {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.trackId !== "string") {
    throw new Error("trackId must be a string.");
  }
  if (value.role !== undefined && value.role !== null && typeof value.role !== "string") {
    throw new Error("role must be a string or null.");
  }
  return {
    trackId: value.trackId,
    role: value.role === undefined ? undefined : value.role,
  };
}

/**
 * List manual track links for a submission.
 * GET /submissions/:id/tracks
 */
export async function GET(_request: Request, context: RouteContext) {
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
    const submission = await getSubmissionById(id);
    if (!submission) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: `Submission "${id}" was not found.` },
        { status: 404 },
      );
    }
    const trackLinks = await loadSerializedTrackLinks(submission.id);
    return NextResponse.json({ ok: true, trackLinks });
  } catch (error) {
    if (isSubmissionsError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("list submission track links failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list submission track links." },
      { status: 500 },
    );
  }
}

/**
 * Manually link an existing library track to a submission (explicit user action only).
 * POST /submissions/:id/tracks
 */
export async function POST(request: Request, context: RouteContext) {
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  let body: { trackId: string; role?: string | null };
  try {
    body = parseBody(json);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
        message: error instanceof Error ? error.message : "Invalid request body.",
      },
      { status: 400 },
    );
  }

  try {
    const track = await getTrackById(body.trackId);
    if (!track) {
      return NextResponse.json(
        {
          ok: false,
          error: "not_found",
          message: `Track "${body.trackId.trim()}" was not found.`,
        },
        { status: 404 },
      );
    }

    const { link, created } = await addSubmissionTrackLink(id, body);
    const trackLinks = await loadSerializedTrackLinks(link.submissionId);
    const submission = await getSubmissionById(link.submissionId);

    return NextResponse.json(
      {
        ok: true,
        trackLink: serializeSubmissionTrackLink(link, {
          id: track.track.id,
          title: track.track.title,
          artists: track.artists,
          artworkUrl: track.track.artworkUrl,
        }),
        trackLinks,
        ...(submission ? { submission: serializeSubmission(submission, trackLinks) } : {}),
      },
      { status: created ? 201 : 200 },
    );
  } catch (error) {
    if (isSubmissionsError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("add submission track link failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to link track to submission." },
      { status: 500 },
    );
  }
}
