import { NextResponse } from "next/server";
import {
  getProposalById,
  getProposalDetail,
  insertProposalReviewEvent,
  isPostgresConfigured,
  updateProposalGuarded,
} from "@selecta/db";

import { serializeProposal, serializeProposalDetail } from "@/lib/proposals";

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
 * Fetch one proposal with note context, siblings, and commit audit.
 * GET /proposals/:id
 */
export async function GET(_request: Request, context: RouteContext) {
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

  try {
    const detail = await getProposalDetail(id);
    if (!detail) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: `Proposal "${id}" was not found.` },
        { status: 404 },
      );
    }
    const serialized = await serializeProposalDetail(detail);
    return NextResponse.json({
      ok: true,
      proposal: serialized.proposal,
      note: serialized.note,
      siblings: serialized.siblings,
      commit: serialized.commit,
    });
  } catch (error) {
    console.error("get proposal failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to load proposal." },
      { status: 500 },
    );
  }
}

/**
 * Park in-progress review selections without committing.
 * PATCH /proposals/:id
 */
export async function PATCH(request: Request, context: RouteContext) {
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

  if (!isRecord(json.reviewState)) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "reviewState must be an object." },
      { status: 400 },
    );
  }

  const existing = await getProposalById(id);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: `Proposal "${id}" was not found.` },
      { status: 404 },
    );
  }
  if (existing.status === "committed" || existing.status === "superseded") {
    return NextResponse.json(
      {
        ok: false,
        error: "proposal_conflict",
        message: "Proposal cannot be edited in this state.",
      },
      { status: 409 },
    );
  }

  try {
    const updated = await updateProposalGuarded(id, {
      expectedUpdatedAt,
      fromStatuses: ["needs_review", "failed", "rejected"],
      set: { reviewState: json.reviewState },
    });
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "proposal_conflict", message: "Proposal was updated elsewhere." },
        { status: 409 },
      );
    }

    await insertProposalReviewEvent({
      proposalId: id,
      action: "edit",
      payload: { reviewState: json.reviewState },
    });

    return NextResponse.json({ ok: true, proposal: await serializeProposal(updated) });
  } catch (error) {
    console.error("patch proposal failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to update proposal." },
      { status: 500 },
    );
  }
}
