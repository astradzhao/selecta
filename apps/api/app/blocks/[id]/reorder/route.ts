import { NextResponse } from "next/server";
import { reorderSequence } from "@selecta/db";

import {
  invalidBody,
  invalidId,
  parseReorderBody,
  sequenceErrorResponse,
  serializeSequence,
} from "@/lib/blocks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Rewrite the full step order in one transaction. Rejects a mismatched id set.
 * POST /blocks/:id/reorder
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
    input = parseReorderBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await reorderSequence(id, input.stepIds, input.expectedUpdatedAt);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to reorder sequence.");
  }
}
