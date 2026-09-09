import { NextResponse } from "next/server";
import { wrapSequenceSpan } from "@selecta/library";

import {
  invalidBody,
  invalidId,
  parseWrapSpanBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Collapse a contiguous span of steps into a new nested block.
 * POST /blocks/:id/wrap
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
    input = parseWrapSpanBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const result = await wrapSequenceSpan(id, input);
    return NextResponse.json(
      {
        ok: true,
        sequence: serializeSequence(result.sequence),
        block: serializeSequence(result.block),
      },
      { status: 201 },
    );
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to make a block from the selected tracks.");
  }
}
