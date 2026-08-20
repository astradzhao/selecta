import { NextResponse } from "next/server";
import {
  deleteTransitionById,
  getTransitionById,
  isMusicWriteError,
  updateTransitionById,
  type UpdateTransitionInput,
} from "@selecta/library";

import { serializeTransition } from "@/lib/transitions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function parseUpdateBody(value: unknown): UpdateTransitionInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  const input: UpdateTransitionInput = {
    fromBar: asOptionalNumber(value.fromBar, "fromBar"),
    toBar: asOptionalNumber(value.toBar, "toBar"),
    barsOverlap: asOptionalNumber(value.barsOverlap, "barsOverlap"),
    technique: asOptionalString(value.technique, "technique"),
    intent: asOptionalString(value.intent, "intent"),
    quality: asOptionalString(value.quality, "quality"),
    notes: asOptionalString(value.notes, "notes"),
  };
  const hasPatch = Object.values(input).some((field) => field !== undefined);
  if (!hasPatch) {
    throw new Error("Provide at least one editable field to update.");
  }
  return input;
}

/**
 * Fetch one transition by stable edge id.
 * GET /transitions/:id
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Transition id is required." },
      { status: 400 },
    );
  }

  try {
    const transition = await getTransitionById(id);
    if (!transition) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: `Transition "${id}" was not found.` },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, transition: serializeTransition(transition) });
  } catch (error) {
    console.error("get transition failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to load transition." },
      { status: 500 },
    );
  }
}

/**
 * Update editable fields on one transition by id.
 * PATCH /transitions/:id
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Transition id is required." },
      { status: 400 },
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

  let input: UpdateTransitionInput;
  try {
    input = parseUpdateBody(json);
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
    const transition = await updateTransitionById(id, input);
    return NextResponse.json({ ok: true, transition: serializeTransition(transition) });
  } catch (error) {
    if (isMusicWriteError(error)) {
      const status = error.code === "not_found" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status },
      );
    }
    console.error("update transition failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to update transition." },
      { status: 500 },
    );
  }
}

/**
 * Hard-delete one transition by id.
 * DELETE /transitions/:id
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Transition id is required." },
      { status: 400 },
    );
  }

  try {
    const result = await deleteTransitionById(id);
    return NextResponse.json({ ok: true, id: result.id, deleted: result.deleted });
  } catch (error) {
    if (isMusicWriteError(error)) {
      const status = error.code === "not_found" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status },
      );
    }
    console.error("delete transition failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to delete transition." },
      { status: 500 },
    );
  }
}
