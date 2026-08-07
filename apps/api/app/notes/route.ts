import { NextResponse } from "next/server";
import {
  createNote,
  isNotesError,
  isPostgresConfigured,
  listNotes,
  noteExtractionStatusEnum,
  type NoteExtractionStatus,
} from "@selecta/db";

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

function parseListOffset(raw: string | null): number | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function parseStatus(raw: string | null): NoteExtractionStatus | undefined {
  if (!raw) return undefined;
  return (noteExtractionStatusEnum.enumValues as readonly string[]).includes(raw)
    ? (raw as NoteExtractionStatus)
    : undefined;
}

function parseIsoDate(raw: string | null, field: string): Date | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid ISO date.`);
  }
  return date;
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
 * List submissions (notes) with Library filters (DJ-72).
 * GET /notes?q=&status=&needsReview=&createdAfter=&createdBefore=&limit=&offset=
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
  const status = parseStatus(searchParams.get("status"));
  if (searchParams.get("status") && !status) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_query",
        message: `Unsupported status "${searchParams.get("status")}".`,
      },
      { status: 400 },
    );
  }

  try {
    const createdAfter = parseIsoDate(searchParams.get("createdAfter"), "createdAfter");
    const createdBefore = parseIsoDate(searchParams.get("createdBefore"), "createdBefore");
    const needsReviewRaw = searchParams.get("needsReview");
    const needsReview =
      needsReviewRaw === "1" || needsReviewRaw === "true"
        ? true
        : needsReviewRaw === "0" || needsReviewRaw === "false"
          ? false
          : undefined;

    const result = await listNotes({
      query: searchParams.get("q") ?? undefined,
      status,
      needsReview,
      createdAfter,
      createdBefore,
      limit: parseListLimit(searchParams.get("limit")),
      offset: parseListOffset(searchParams.get("offset")),
    });

    return NextResponse.json({
      ok: true,
      notes: result.notes.map((item) =>
        serializeNote(item.note, undefined, {
          proposalCounts: item.proposalCounts,
          proposals: item.proposals,
        }),
      ),
      // Alias for Library "Submissions" wording.
      submissions: result.notes.map((item) =>
        serializeNote(item.note, undefined, {
          proposalCounts: item.proposalCounts,
          proposals: item.proposals,
        }),
      ),
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("must be a valid ISO date")) {
      return NextResponse.json(
        { ok: false, error: "invalid_query", message: error.message },
        { status: 400 },
      );
    }
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
