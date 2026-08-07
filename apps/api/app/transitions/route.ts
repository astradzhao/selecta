import { NextResponse } from "next/server";
import {
  createTransition,
  isGraphWriteError,
  isNeo4jConfigured,
  listTransitions,
  type CreateTransitionInput,
} from "@selecta/graph";
import { getProposalsByIds, isPostgresConfigured } from "@selecta/db";

import { serializeTransition, summarizeProposalForTransition } from "@/lib/transitions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOptionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }
  return value;
}

function asOptionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  return value;
}

function parseCreateBody(value: unknown): CreateTransitionInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  const fromTrackId = value.fromTrackId;
  const toTrackId = value.toTrackId;
  if (typeof fromTrackId !== "string" || !fromTrackId.trim()) {
    throw new Error("fromTrackId is required.");
  }
  if (typeof toTrackId !== "string" || !toTrackId.trim()) {
    throw new Error("toTrackId is required.");
  }
  return {
    fromTrackId,
    toTrackId,
    fromBar: asOptionalNumber(value.fromBar, "fromBar"),
    toBar: asOptionalNumber(value.toBar, "toBar"),
    barsOverlap: asOptionalNumber(value.barsOverlap, "barsOverlap"),
    technique: asOptionalString(value.technique, "technique"),
    intent: asOptionalString(value.intent, "intent"),
    quality: asOptionalString(value.quality, "quality"),
    notes: asOptionalString(value.notes, "notes"),
  };
}

function parseListLimit(raw: string | null): number | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function parseListOffset(raw: string | null): number | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

/**
 * Library search/list for transitions (DJ-72).
 * GET /transitions?q=&fromTrackId=&toTrackId=&technique=&intent=&quality=&sourceNoteId=&source=&sort=&order=&limit=&offset=
 */
export async function GET(request: Request) {
  if (!isNeo4jConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "graph_not_configured",
        message: "Neo4j is not configured.",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const sourceRaw = searchParams.get("source");
  const source = sourceRaw === "manual" || sourceRaw === "ai" ? sourceRaw : undefined;
  const sortRaw = searchParams.get("sort");
  const sort = sortRaw === "createdAt" || sortRaw === "updatedAt" ? sortRaw : undefined;
  const orderRaw = searchParams.get("order");
  const order = orderRaw === "asc" || orderRaw === "desc" ? orderRaw : undefined;
  const includeReview = searchParams.get("includeReview") !== "0";

  try {
    const result = await listTransitions({
      query: searchParams.get("q") ?? undefined,
      fromTrackId: searchParams.get("fromTrackId") ?? undefined,
      toTrackId: searchParams.get("toTrackId") ?? undefined,
      technique: searchParams.get("technique") ?? undefined,
      intent: searchParams.get("intent") ?? undefined,
      quality: searchParams.get("quality") ?? undefined,
      sourceNoteId: searchParams.get("sourceNoteId") ?? undefined,
      source,
      createdAfter: searchParams.get("createdAfter") ?? undefined,
      createdBefore: searchParams.get("createdBefore") ?? undefined,
      updatedAfter: searchParams.get("updatedAfter") ?? undefined,
      updatedBefore: searchParams.get("updatedBefore") ?? undefined,
      sort,
      order,
      limit: parseListLimit(searchParams.get("limit")),
      offset: parseListOffset(searchParams.get("offset")),
    });

    let proposalById = new Map<string, ReturnType<typeof summarizeProposalForTransition>>();
    if (includeReview && isPostgresConfigured()) {
      const ids = result.transitions
        .map((row) => row.edge.sourceProposalId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      const proposals = await getProposalsByIds(ids);
      proposalById = new Map(
        [...proposals.entries()].map(([id, proposal]) => [
          id,
          summarizeProposalForTransition(proposal),
        ]),
      );
    }

    return NextResponse.json({
      ok: true,
      transitions: result.transitions.map((row) =>
        serializeTransition(
          row,
          row.edge.sourceProposalId ? (proposalById.get(row.edge.sourceProposalId) ?? null) : null,
        ),
      ),
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (isGraphWriteError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    console.error("list transitions failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list transitions." },
      { status: 500 },
    );
  }
}

/**
 * Create a manual transition between two existing tracks.
 * POST /transitions
 */
export async function POST(request: Request) {
  if (!isNeo4jConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "graph_not_configured",
        message: "Neo4j is not configured.",
      },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  let input: CreateTransitionInput;
  try {
    input = parseCreateBody(json);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
        message: error instanceof Error ? error.message : "Invalid request body.",
      },
      { status: 400 },
    );
  }

  try {
    const transition = await createTransition(input);
    return NextResponse.json(
      { ok: true, transition: serializeTransition(transition) },
      { status: 201 },
    );
  } catch (error) {
    if (isGraphWriteError(error)) {
      const status = error.code === "not_found" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status },
      );
    }
    console.error("create transition failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to create transition." },
      { status: 500 },
    );
  }
}
