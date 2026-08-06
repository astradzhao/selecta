import { NextResponse } from "next/server";
import {
  createTransition,
  isGraphWriteError,
  isNeo4jConfigured,
  listTransitions,
  type CreateTransitionInput,
} from "@selecta/graph";

import { serializeTransition } from "@/lib/transitions";

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

/**
 * List transitions filtered by from and/or to track id.
 * GET /transitions?fromTrackId=&toTrackId=&limit=
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
  const fromTrackId = searchParams.get("fromTrackId") ?? undefined;
  const toTrackId = searchParams.get("toTrackId") ?? undefined;
  if (!fromTrackId?.trim() && !toTrackId?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_query",
        message: "Provide fromTrackId and/or toTrackId.",
      },
      { status: 400 },
    );
  }

  try {
    const transitions = await listTransitions({
      fromTrackId,
      toTrackId,
      limit: parseListLimit(searchParams.get("limit")),
    });
    return NextResponse.json({
      ok: true,
      transitions: transitions.map(serializeTransition),
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
