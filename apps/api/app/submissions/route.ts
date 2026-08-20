import { NextResponse } from "next/server";
import {
  isPostgresConfigured,
  submissionExtractionStatusEnum,
  type SubmissionExtractionStatus,
} from "@selecta/db";
import { createSubmission, isSubmissionsError, listSubmissions } from "@selecta/submissions";

import { serializeSubmission } from "@/lib/submissions";

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

function parseStatus(raw: string | null): SubmissionExtractionStatus | undefined {
  if (!raw) return undefined;
  return (submissionExtractionStatusEnum.enumValues as readonly string[]).includes(raw)
    ? (raw as SubmissionExtractionStatus)
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
 * List submissions with Library filters (DJ-72).
 * GET /submissions?q=&status=&needsReview=&createdAfter=&createdBefore=&limit=&offset=
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

    const result = await listSubmissions({
      query: searchParams.get("q") ?? undefined,
      status,
      needsReview,
      createdAfter,
      createdBefore,
      limit: parseListLimit(searchParams.get("limit")),
      offset: parseListOffset(searchParams.get("offset")),
    });

    const serialized = result.submissions.map((item) =>
      serializeSubmission(item.submission, undefined, {
        proposalCounts: item.proposalCounts,
        proposals: item.proposals,
      }),
    );

    return NextResponse.json({
      ok: true,
      submissions: serialized,
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
    console.error("list submissions failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list submissions." },
      { status: 500 },
    );
  }
}

/**
 * Create a free-form submission from raw text, then extract via durable workflow.
 * POST /submissions
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
    const submission = await createSubmission(body);
    const { startSubmissionWorkflow } = await import("@/lib/start-submission-workflow");
    const { workflowRunId } = await startSubmissionWorkflow(
      submission.id,
      submission.extractionVersion,
    );
    return NextResponse.json(
      { ok: true, submission: serializeSubmission(submission, []), workflowRunId },
      { status: 201 },
    );
  } catch (error) {
    if (isSubmissionsError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    console.error("create submission failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to create submission." },
      { status: 500 },
    );
  }
}
