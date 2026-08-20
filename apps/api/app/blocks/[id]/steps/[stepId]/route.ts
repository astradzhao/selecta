import { NextResponse } from "next/server";
import { deleteSequenceStep, updateSequenceStep } from "@selecta/library";

import {
  invalidBody,
  invalidId,
  parseUpdateStepBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string; stepId: string }>;
};

/**
 * Patch a step (track, connector, seam, note). 422 on endpoint mismatch.
 * PATCH /blocks/:id/steps/:stepId
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id, stepId } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }
  if (!stepId?.trim()) {
    return invalidId("Step id");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidBody("Request body must be JSON.");
  }

  let input;
  try {
    input = parseUpdateStepBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await updateSequenceStep(id, stepId, input);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to update sequence step.");
  }
}

/**
 * Remove a step. Alternates bounded by it cascade via FK.
 * DELETE /blocks/:id/steps/:stepId
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id, stepId } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }
  if (!stepId?.trim()) {
    return invalidId("Step id");
  }

  try {
    const sequence = await deleteSequenceStep(id, stepId);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to delete sequence step.");
  }
}
