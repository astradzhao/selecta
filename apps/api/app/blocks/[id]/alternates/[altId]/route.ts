import { NextResponse } from "next/server";
import { deleteSequenceAlternate, updateSequenceAlternate } from "@selecta/db";

import {
  invalidBody,
  invalidId,
  parseUpdateAlternateBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string; altId: string }>;
};

/**
 * Patch an alternate span or connector.
 * PATCH /blocks/:id/alternates/:altId
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id, altId } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }
  if (!altId?.trim()) {
    return invalidId("Alternate id");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidBody("Request body must be JSON.");
  }

  let input;
  try {
    input = parseUpdateAlternateBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await updateSequenceAlternate(id, altId, input);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to update alternate.");
  }
}

/**
 * Delete an alternate. Version choices cascade via FK.
 * DELETE /blocks/:id/alternates/:altId
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id, altId } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }
  if (!altId?.trim()) {
    return invalidId("Alternate id");
  }

  try {
    const sequence = await deleteSequenceAlternate(id, altId);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to delete alternate.");
  }
}
