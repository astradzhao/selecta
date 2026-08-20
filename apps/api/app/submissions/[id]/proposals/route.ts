import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@selecta/db";
import { getSubmissionById, listProposals } from "@selecta/submissions";

import { serializeProposals } from "@/lib/proposals";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseVersion(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.floor(value) : undefined;
}

/**
 * List proposals for one submission (defaults to current extraction version).
 * GET /submissions/:id/proposals?version=
 */
export async function GET(request: Request, context: RouteContext) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, error: "db_not_configured", message: "Postgres is not configured." },
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

  const submission = await getSubmissionById(id);
  if (!submission) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: `Submission "${id}" was not found.` },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);
  const versionRaw = searchParams.get("version");
  const version = parseVersion(versionRaw) ?? submission.extractionVersion;
  if (versionRaw && parseVersion(versionRaw) === undefined) {
    return NextResponse.json(
      { ok: false, error: "invalid_query", message: "version must be a number." },
      { status: 400 },
    );
  }

  try {
    const result = await listProposals({
      submissionId: submission.id,
      extractionVersion: version,
    });

    return NextResponse.json({
      ok: true,
      proposals: await serializeProposals(result.proposals),
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("list submission proposals failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list proposals." },
      { status: 500 },
    );
  }
}
