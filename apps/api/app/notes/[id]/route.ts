import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@selecta/db";
import { getNoteById, isNotesError, updateNote } from "@selecta/submissions";

import { loadSerializedTrackLinks, serializeNote } from "@/lib/notes";

/** Durable workflow continues after the update response. */
export const maxDuration = 300;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseUpdateBody(value: unknown): { rawText: string } {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.rawText !== "string") {
    throw new Error("rawText must be a string.");
  }
  return { rawText: value.rawText };
}

/**
 * Fetch a single note (includes optional manual track links).
 * GET /notes/:id
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
      { ok: false, error: "invalid_id", message: "Note id is required." },
      { status: 400 },
    );
  }

  try {
    const note = await getNoteById(id);
    if (!note) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: `Note "${id}" was not found.` },
        { status: 404 },
      );
    }
    const trackLinks = await loadSerializedTrackLinks(note.id);
    return NextResponse.json({ ok: true, note: serializeNote(note, trackLinks) });
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("get note failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to load note." },
      { status: 500 },
    );
  }
}

/**
 * Edit raw note text. Text changes invalidate prior extraction and start a new version.
 * PATCH /notes/:id
 */
export async function PATCH(request: Request, context: RouteContext) {
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  let body: { rawText: string };
  try {
    body = parseUpdateBody(json);
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
    const { note, extractionQueued } = await updateNote(id, body);
    let workflowRunId: string | undefined;
    if (extractionQueued) {
      const { startSubmissionWorkflow } = await import("@/lib/start-submission-workflow");
      ({ workflowRunId } = await startSubmissionWorkflow(note.id, note.extractionVersion));
    }
    const trackLinks = await loadSerializedTrackLinks(note.id);
    return NextResponse.json({
      ok: true,
      note: serializeNote(note, trackLinks),
      ...(workflowRunId ? { workflowRunId } : {}),
    });
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("update note failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to update note." },
      { status: 500 },
    );
  }
}
