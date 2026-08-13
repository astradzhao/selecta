import { NextResponse } from "next/server";
import { createSequenceAlternate } from "@selecta/db";

import {
  invalidBody,
  invalidId,
  parseCreateAlternateBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Add an alternate span. Exactly one of altTransitionId or altBlockId.
 * POST /blocks/:id/alternates
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidBody("Request body must be JSON.");
  }

  let input;
  try {
    input = parseCreateAlternateBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await createSequenceAlternate(id, input);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) }, { status: 201 });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to create alternate.");
  }
}
