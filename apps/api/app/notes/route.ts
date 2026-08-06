import { NextResponse } from "next/server";
import { createNote, isNotesError, isPostgresConfigured, listNotes } from "@selecta/db";

import { serializeNote } from "@/lib/notes";
import { startSubmissionWorkflow } from "@/lib/start-submission-workflow";

/** Durable workflow continues after the create response. */
export const maxDuration = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseListLimit(raw: string | null): number | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function parseCreateBody(value: unknown): { rawText: string } {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.rawText !== "string") {
    throw new Error("rawText must be a string.");
  }
  return { rawText: value.rawText };
}

/**
 * List free-form notes newest-first.
 * GET /notes?limit=
 */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  try {
    const rows = await listNotes({
      limit: parseListLimit(searchParams.get("limit")),
    });
    return NextResponse.json({
      ok: true,
      notes: rows.map((note) => serializeNote(note)),
    });
  } catch (error) {
    console.error("list notes failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list notes." },
      { status: 500 },
    );
  }
}

/**
 * Create a free-form note from raw text alone, then extract via durable workflow.
 * POST /notes
 */
export async function POST(request: Request) {
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
    body = parseCreateBody(json);
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
    const note = await createNote(body);
    const { workflowRunId } = await startSubmissionWorkflow(note.id, note.extractionVersion);
    return NextResponse.json(
      { ok: true, note: serializeNote(note, []), workflowRunId },
      { status: 201 },
    );
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    console.error("create note failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to create note." },
      { status: 500 },
    );
  }
}
