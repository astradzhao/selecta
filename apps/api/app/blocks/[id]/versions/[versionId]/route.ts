import { NextResponse } from "next/server";
import { deleteSequenceVersion, updateSequenceVersion } from "@selecta/db";

import {
  invalidBody,
  invalidId,
  parseUpdateVersionBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string; versionId: string }>;
};

/**
 * Rename a version or replace its chosen alternates. 422 on overlapping spans.
 * PATCH /blocks/:id/versions/:versionId
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id, versionId } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }
  if (!versionId?.trim()) {
    return invalidId("Version id");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidBody("Request body must be JSON.");
  }

  let input;
  try {
    input = parseUpdateVersionBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await updateSequenceVersion(id, versionId, input);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to update version.");
  }
}

/**
 * Delete a version. Choices cascade via FK.
 * DELETE /blocks/:id/versions/:versionId
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id, versionId } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }
  if (!versionId?.trim()) {
    return invalidId("Version id");
  }

  try {
    const sequence = await deleteSequenceVersion(id, versionId);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to delete version.");
  }
}
