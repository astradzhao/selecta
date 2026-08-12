import { NextResponse } from "next/server";
import {
  getProposalById,
  insertProposalReviewEvent,
  isPostgresConfigured,
  refreshSubmissionExtractionStatus,
  updateProposalGuarded,
  upsertTransitionCommit,
} from "@selecta/db";

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
 * Reject a proposal without mutating submission text or committed siblings.
 * POST /proposals/:id/reject
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Request body must be JSON." },
      { status: 400 },
    );
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

  if (proposal.status === "committed") {
    return NextResponse.json(
      {
        ok: false,
        error: "proposal_conflict",
        message: "Proposal is committed — delete the transition instead.",
      },
      { status: 409 },
    );
  }

  if (proposal.status === "superseded") {
    return NextResponse.json(
      { ok: false, error: "proposal_conflict", message: "Proposal was superseded." },
      { status: 409 },
    );
  }

  const reason = typeof json.reason === "string" ? json.reason : null;
  const now = new Date();

  const updated = await updateProposalGuarded(id, {
    expectedUpdatedAt,
    fromStatuses: ["needs_review", "failed"],
    set: {
      status: "rejected",
      reviewedAt: now,
      reviewNote: reason,
    },
  });

  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "proposal_conflict", message: "Proposal was updated elsewhere." },
      { status: 409 },
    );
  }

  try {
    await upsertTransitionCommit({
      noteId: proposal.noteId,
      extractionVersion: proposal.extractionVersion,
      proposalKey: proposal.proposalKey,
      status: "rejected",
      payload: { reason, reviewed: true },
    });
    await insertProposalReviewEvent({
      proposalId: id,
      action: "reject",
      payload: { reason },
    });
    await refreshSubmissionExtractionStatus(proposal.noteId, proposal.extractionVersion);

    const refreshed = await getProposalById(id);
    return NextResponse.json({
      ok: true,
      proposal: await serializeProposal(refreshed ?? updated),
    });
  } catch (error) {
    console.error("reject proposal failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to reject proposal." },
      { status: 500 },
    );
  }
}
