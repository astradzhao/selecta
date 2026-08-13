import { NextResponse } from "next/server";
import { addSequenceStep } from "@selecta/db";

import {
  invalidBody,
  invalidId,
  parseAddStepBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Append or insert a step. Cycle-checked when linking a block connector.
 * POST /blocks/:id/steps
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
    input = parseAddStepBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await addSequenceStep(id, input);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) }, { status: 201 });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to add sequence step.");
  }
}
