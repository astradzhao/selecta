import { NextResponse } from "next/server";
import { createSequenceVersion } from "@selecta/library";

import {
  invalidBody,
  invalidId,
  parseCreateVersionBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Create a named version. 422 if chosen alternates overlap.
 * POST /blocks/:id/versions
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
    input = parseCreateVersionBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await createSequenceVersion(id, input);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) }, { status: 201 });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to create version.");
  }
}
