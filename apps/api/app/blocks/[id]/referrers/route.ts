import { NextResponse } from "next/server";
import { getSequenceReferrers } from "@selecta/library";

import { invalidId, sequenceErrorResponse } from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Sequences that use this block as a connector.
 * GET /blocks/:id/referrers
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }

  try {
    const referrers = await getSequenceReferrers(id);
    return NextResponse.json({ ok: true, referrers });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to load sequence referrers.");
  }
}
