import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@selecta/db";

import { resolveSingleProposal } from "@/lib/proposal-actions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Re-run deterministic resolution for one proposal.
 * POST /proposals/:id/resolve
 */
export async function POST(_request: Request, context: RouteContext) {
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
    const result = await resolveSingleProposal(id);
    return NextResponse.json({
      ok: true,
      committed: result.committed,
      proposal: result.proposal,
      transition: result.transition,
      reverseTransition: result.reverseTransition,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "not_found") {
        return NextResponse.json(
          { ok: false, error: "not_found", message: `Proposal "${id}" was not found.` },
          { status: 404 },
        );
      }
      if (error.message === "missing_draft") {
        return NextResponse.json(
          { ok: false, error: "invalid_body", message: "Proposal has no draft to resolve." },
          { status: 400 },
        );
      }
    }
    console.error("resolve proposal failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to resolve proposal." },
      { status: 500 },
    );
  }
}
