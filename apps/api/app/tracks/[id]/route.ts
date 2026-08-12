import { NextResponse } from "next/server";
import {
  deleteTrackById,
  getTrackById,
  isMusicWriteError,
  updateTrackById,
  type FolderRef,
  type NamedRef,
  type TrackDetail,
  type UpdateTrackInput,
} from "@selecta/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value;
}

function asNamedRefs(value: unknown, field: string): NamedRef[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`${field}[${index}] must be an object.`);
    }
    const id = item.id;
    const name = item.name;
    if (id !== undefined && typeof id !== "string") {
      throw new Error(`${field}[${index}].id must be a string.`);
    }
    if (name !== undefined && typeof name !== "string") {
      throw new Error(`${field}[${index}].name must be a string.`);
    }
    return {
      ...(typeof id === "string" ? { id } : {}),
      ...(typeof name === "string" ? { name } : {}),
    };
  });
}

function asFolderRefs(value: unknown): FolderRef[] | undefined {
  const refs = asNamedRefs(value, "folders");
  if (!refs || !Array.isArray(value)) {
    return refs;
  }
  return value.map((item, index) => {
    const base = refs[index]!;
    if (!isRecord(item)) {
      return base;
    }
    const kind = item.kind;
    if (kind !== undefined && typeof kind !== "string") {
      throw new Error(`folders[${index}].kind must be a string.`);
    }
    return {
      ...base,
      ...(typeof kind === "string" ? { kind: kind as FolderRef["kind"] } : {}),
    };
  });
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

function parseUpdateBody(value: unknown): UpdateTrackInput {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if ("externalIds" in value || "catalog" in value) {
    throw new Error("Provider identity fields (externalIds / catalog) cannot be updated.");
  }

  const input: UpdateTrackInput = {
    title: asOptionalString(value.title, "title") ?? undefined,
    artists: asStringArray(value.artists, "artists"),
    genres: asStringArray(value.genres, "genres"),
    subgenres: asNamedRefs(value.subgenres, "subgenres"),
    folders: asFolderRefs(value.folders),
    artworkUrl: asOptionalString(value.artworkUrl, "artworkUrl"),
    durationSec: asOptionalNumber(value.durationSec, "durationSec"),
    releaseDate: asOptionalString(value.releaseDate, "releaseDate"),
    bpm: asOptionalNumber(value.bpm, "bpm"),
    musicalKey: asOptionalString(value.musicalKey, "musicalKey"),
    energy: asOptionalNumber(value.energy, "energy"),
  };

  const hasPatch = Object.values(input).some((field) => field !== undefined);
  if (!hasPatch) {
    throw new Error("Provide at least one editable field to update.");
  }
  return input;
}

function serializeTrackDetail(detail: TrackDetail) {
  return {
    id: detail.track.id,
    title: detail.track.title,
    artists: detail.artists,
    genres: detail.genres,
    subgenres: detail.subgenres,
    folders: detail.folders,
    artworkUrl: detail.track.artworkUrl,
    durationSec: detail.track.durationSec,
    releaseDate: detail.track.releaseDate,
    bpm: detail.track.bpm,
    musicalKey: detail.track.musicalKey,
    energy: detail.track.energy,
    externalIds: detail.track.externalIds,
    libraryId: detail.track.libraryId,
    createdAt: detail.track.createdAt,
    updatedAt: detail.track.updatedAt,
    hasOutboundTransitions: detail.hasOutboundTransitions,
    hasInboundTransitions: detail.hasInboundTransitions,
  };
}

/**
 * Track detail: properties, artists, genres, Subgenres, Folders, transition presence.
 * GET /tracks/:id
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Track id is required." },
      { status: 400 },
    );
  }

  try {
    const detail = await getTrackById(id);
    if (!detail) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: `Track "${id}" was not found.` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      track: serializeTrackDetail(detail),
    });
  } catch (error) {
    console.error("get track failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to load track." },
      { status: 500 },
    );
  }
}

/**
 * Update editable DJ-owned fields and organization metadata on one track.
 * Provider identity / external ids cannot be mutated.
 * PATCH /tracks/:id
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Track id is required." },
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

  let input: UpdateTrackInput;
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
    const detail = await updateTrackById(id, input);
    return NextResponse.json({ ok: true, track: serializeTrackDetail(detail) });
  } catch (error) {
    if (isMusicWriteError(error)) {
      const status = error.code === "not_found" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status },
      );
    }
    console.error("update track failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to update track." },
      { status: 500 },
    );
  }
}

/**
 * Hard-delete one track by id (FK cascades remove joins and transitions).
 * DELETE /tracks/:id
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Track id is required." },
      { status: 400 },
    );
  }

  try {
    const result = await deleteTrackById(id);
    return NextResponse.json({ ok: true, id: result.id, deleted: result.deleted });
  } catch (error) {
    if (isMusicWriteError(error)) {
      const status = error.code === "not_found" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status },
      );
    }
    console.error("delete track failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to delete track." },
      { status: 500 },
    );
  }
}
