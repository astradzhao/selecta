import { NextResponse } from "next/server";
import { deleteSequence, getSequenceDetail, updateSequence } from "@selecta/db";

import {
  invalidBody,
  invalidId,
  parseDetailQuery,
  parseUpdateSequenceBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Sequence detail: steps, gap states, alternates, versions. `?expand=1` `&version=`.
 * GET /blocks/:id
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }

  try {
    const sequence = await getSequenceDetail(
      id,
      parseDetailQuery(new URL(request.url).searchParams),
    );
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to load sequence.");
  }
}

/**
 * Patch kind/title/description. Requires expectedUpdatedAt.
 * PATCH /blocks/:id
 */
export async function PATCH(request: Request, context: RouteContext) {
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
    input = parseUpdateSequenceBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await updateSequence(id, input);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to update sequence.");
  }
}

/**
 * Delete a sequence. 409 with referrers if it is used as a connector.
 * DELETE /blocks/:id
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return invalidId("Sequence id");
  }

  try {
    const result = await deleteSequence(id);
    return NextResponse.json({ ok: true, id: result.id, deleted: result.deleted });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to delete sequence.");
  }
}
