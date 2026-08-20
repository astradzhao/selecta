import { NextResponse } from "next/server";
import {
  isPostgresConfigured,
  submissionProposalStatusEnum,
  type SubmissionProposalStatus,
} from "@selecta/db";
import { listProposals } from "@selecta/submissions";

import { serializeProposals } from "@/lib/proposals";

function parseListLimit(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseListOffset(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseStatuses(raw: string | null): SubmissionProposalStatus[] | undefined {
  if (!raw?.trim()) return undefined;
  const allowed = new Set(submissionProposalStatusEnum.enumValues);
  const statuses = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is SubmissionProposalStatus =>
      allowed.has(part as SubmissionProposalStatus),
    );
  return statuses.length > 0 ? statuses : undefined;
}

/**
 * Review queue and cross-submission proposal list.
 * GET /proposals?status=&submissionId=&q=&limit=&offset=
 */
export async function GET(request: Request) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, error: "db_not_configured", message: "Postgres is not configured." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const statuses = parseStatuses(searchParams.get("status"));
  if (searchParams.get("status") && !statuses) {
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
    const result = await listProposals({
      submissionId: searchParams.get("submissionId") ?? undefined,
      query: searchParams.get("q") ?? undefined,
      statuses,
      limit: parseListLimit(searchParams.get("limit")),
      offset: parseListOffset(searchParams.get("offset")),
    });

    return NextResponse.json({
      ok: true,
      proposals: await serializeProposals(result.proposals),
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("list proposals failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list proposals." },
      { status: 500 },
    );
  }
}
