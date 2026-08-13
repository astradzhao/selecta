import { NextResponse } from "next/server";
import { createSequence, listSequences } from "@selecta/db";

import {
  invalidBody,
  parseCreateSequenceBody,
  parseListQuery,
  sequenceErrorResponse,
  serializeSequence,
  serializeSequenceRecord,
} from "@/lib/blocks";

/**
 * List sequences (sets/blocks). Query: kind, q, complete, startTrack, endTrack, limit, offset.
 * GET /blocks
 */
export async function GET(request: Request) {
  let input;
  try {
    input = parseListQuery(new URL(request.url).searchParams);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid query.");
  }

  try {
    const result = await listSequences(input);
    return NextResponse.json({
      ok: true,
      sequences: result.sequences.map(serializeSequenceRecord),
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to list sequences.");
  }
}

/**
 * Create a sequence. `seed` is `{ trackIds }` or `{ trail }` ("Save trail as a block").
 * POST /blocks
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return invalidBody("Request body must be JSON.");
  }

  let input;
  try {
    input = parseCreateSequenceBody(json);
  } catch (error) {
    return invalidBody(error instanceof Error ? error.message : "Invalid request body.");
  }

  try {
    const sequence = await createSequence(input);
    return NextResponse.json({ ok: true, sequence: serializeSequence(sequence) }, { status: 201 });
  } catch (error) {
    return sequenceErrorResponse(error, "Failed to create sequence.");
  }
}
