import { NextResponse } from "next/server";
import { detachSequenceStep } from "@selecta/db";

import { invalidId, sequenceErrorResponse, serializeSequence } from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string; stepId: string }>;
};

/**
 * Inline a block connector's steps as editable rows on the parent.
 * POST /blocks/:id/detach/:stepId
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id, stepId } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }
  if (!stepId?.trim()) {
    return invalidId("Step id");
  }

  try {
    const sequence = await detachSequenceStep(id, stepId);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to detach block connector.");
  }
}
