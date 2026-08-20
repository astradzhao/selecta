import { NextResponse } from "next/server";
import {
  assertReviewerEndpoint,
  buildReviewerPolicyResult,
  draftToSingleUnresolvedPlan,
  type SubmissionProcessingPlan,
  type SubmissionTransitionPlan,
  type SingleTransitionDraft,
} from "@selecta/mix-notes";
import { isPostgresConfigured } from "@selecta/db";
import { getProposalById, updateProposalGuarded } from "@selecta/submissions";

import { commitProposalPolicy, loadCommittedTransition } from "@/lib/proposal-actions";
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

function asOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Expected string or null.");
  }
  return value;
}

function asOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Expected finite number or null.");
  }
  return value;
}

function parseTransitionPatch(value: unknown): Partial<SubmissionTransitionPlan> {
  if (!isRecord(value)) {
    throw new Error("transition must be an object.");
  }
  return {
    fromBar: asOptionalNumber(value.fromBar),
    toBar: asOptionalNumber(value.toBar),
    barsOverlap: asOptionalNumber(value.barsOverlap),
    technique: asOptionalString(value.technique),
    intent: asOptionalString(value.intent),
    quality: asOptionalString(value.quality) as SubmissionTransitionPlan["quality"],
    notes: asOptionalString(value.notes),
  };
}

function buildReviewerPlan(
  draft: SingleTransitionDraft,
  transitionPatch: Partial<SubmissionTransitionPlan>,
  bidirectional: boolean,
): SubmissionProcessingPlan {
  const base = draftToSingleUnresolvedPlan(draft);
  return {
    ...base,
    confidence: "full",
    bidirectional,
    transitions: [{ ...base.transitions[0]!, ...transitionPatch }],
  };
}

/**
 * Approve a proposal and commit the transition transactionally.
 * POST /proposals/:id/approve
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
  let transitionPatch: Partial<SubmissionTransitionPlan>;
  try {
    expectedUpdatedAt = parseExpectedUpdatedAt(json.expectedUpdatedAt);
    transitionPatch = parseTransitionPatch(json.transition ?? {});
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
    const loaded = await loadCommittedTransition(proposal);
    return NextResponse.json({
      ok: true,
      alreadyCommitted: true,
      proposal: await serializeProposal(proposal),
      transition: loaded.transition,
      reverseTransition: loaded.reverseTransition,
    });
  }

  if (proposal.status === "superseded" || proposal.status === "rejected") {
    return NextResponse.json(
      {
        ok: false,
        error: "proposal_conflict",
        message: "Proposal cannot be approved in this state.",
      },
      { status: 409 },
    );
  }

  const draft = proposal.draft as SingleTransitionDraft | null;
  if (!draft) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Proposal has no draft to approve." },
      { status: 400 },
    );
  }

  const bidirectional = json.bidirectional === true;
  const reviewNote = typeof json.reviewNote === "string" ? json.reviewNote : null;

  let policy;
  try {
    const plan = buildReviewerPlan(draft, transitionPatch, bidirectional);
    policy = buildReviewerPolicyResult({
      plan,
      from: assertReviewerEndpoint(json.from, "from"),
      to: assertReviewerEndpoint(json.to, "to"),
      bidirectional,
      transition: transitionPatch,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
        message: error instanceof Error ? error.message : "Invalid approve body.",
      },
      { status: 400 },
    );
  }

  const guarded = await updateProposalGuarded(id, {
    expectedUpdatedAt,
    fromStatuses: ["needs_review", "failed"],
    set: { reviewNote },
  });
  if (!guarded) {
    return NextResponse.json(
      { ok: false, error: "proposal_conflict", message: "Proposal was updated elsewhere." },
      { status: 409 },
    );
  }

  try {
    const plan = buildReviewerPlan(draft, transitionPatch, bidirectional);
    const result = await commitProposalPolicy({
      proposal: guarded,
      plan,
      policy,
      reviewNote,
    });
    return NextResponse.json({
      ok: true,
      alreadyCommitted: false,
      proposal: result.proposal,
      transition: result.transition,
      reverseTransition: result.reverseTransition,
    });
  } catch (error) {
    console.error("approve proposal failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : "Failed to approve proposal.",
      },
      { status: 500 },
    );
  }
}
