import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@selecta/db";
import {
  getProposalById,
  insertProposalReviewEvent,
  refreshSubmissionExtractionStatus,
  updateProposalGuarded,
} from "@selecta/submissions";

import { serializeProposal } from "@/lib/proposals";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseExpectedUpdatedAt(value: unknown): Date {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("expectedUpdatedAt is required.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("expectedUpdatedAt must be a valid ISO date.");
  }
  return date;
}

/**
 * Reopen a rejected proposal back into the review queue.
 * POST /proposals/:id/reopen
 */
export async function POST(request: Request, context: RouteContext) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, error: "db_not_configured", message: "Postgres is not configured." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Proposal id is required." },
      { status: 400 },
    );
  }

  let json: unknown = {};
  if (request.headers.get("content-length") !== "0") {
    try {
      json = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "invalid_body", message: "Request body must be JSON." },
        { status: 400 },
      );
    }
  }

  if (!isRecord(json)) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "JSON body must be an object." },
      { status: 400 },
    );
  }

  let expectedUpdatedAt: Date;
  try {
    expectedUpdatedAt = parseExpectedUpdatedAt(json.expectedUpdatedAt);
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

  const proposal = await getProposalById(id);
  if (!proposal) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: `Proposal "${id}" was not found.` },
      { status: 404 },
    );
  }

  if (proposal.status !== "rejected") {
    return NextResponse.json(
      {
        ok: false,
        error: "proposal_conflict",
        message: "Only rejected proposals can be reopened.",
      },
      { status: 409 },
    );
  }

  const updated = await updateProposalGuarded(id, {
    expectedUpdatedAt,
    fromStatuses: ["rejected"],
    set: {
      status: "needs_review",
      reviewNote: null,
      reviewedAt: null,
    },
  });

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "proposal_conflict", message: "Proposal was updated elsewhere." },
      { status: 409 },
    );
  }

  try {
    await insertProposalReviewEvent({
      proposalId: id,
      action: "reopen",
    });
    await refreshSubmissionExtractionStatus(proposal.noteId, proposal.extractionVersion);
    const refreshed = await getProposalById(id);
    return NextResponse.json({
      ok: true,
      proposal: await serializeProposal(refreshed ?? updated),
    });
  } catch (error) {
    console.error("reopen proposal failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to reopen proposal." },
      { status: 500 },
    );
  }
}
