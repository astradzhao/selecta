import { NextResponse } from "next/server";
import {
  addNoteTrackLink,
  getNoteById,
  getTrackById,
  isNotesError,
  isPostgresConfigured,
} from "@selecta/db";

import { loadSerializedTrackLinks, serializeNote, serializeNoteTrackLink } from "@/lib/notes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): { trackId: string; role?: string | null } {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.trackId !== "string") {
    throw new Error("trackId must be a string.");
  }
  if (value.role !== undefined && value.role !== null && typeof value.role !== "string") {
    throw new Error("role must be a string or null.");
  }
  return {
    trackId: value.trackId,
    role: value.role === undefined ? undefined : value.role,
  };
}

/**
 * List manual track links for a note.
 * GET /notes/:id/tracks
 */
export async function GET(_request: Request, context: RouteContext) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_not_configured",
        message: "Postgres is not configured.",
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Note id is required." },
      { status: 400 },
    );
  }

  try {
    const note = await getNoteById(id);
    if (!note) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: `Note "${id}" was not found.` },
        { status: 404 },
      );
    }
    const trackLinks = await loadSerializedTrackLinks(note.id);
    return NextResponse.json({ ok: true, trackLinks });
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("list note track links failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list note track links." },
      { status: 500 },
    );
  }
}

/**
 * Manually link an existing library track to a note (explicit user action only).
 * POST /notes/:id/tracks
 */
export async function POST(request: Request, context: RouteContext) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "db_not_configured",
        message: "Postgres is not configured.",
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Note id is required." },
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

  let body: { trackId: string; role?: string | null };
  try {
    body = parseBody(json);
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
    const track = await getTrackById(body.trackId);
    if (!track) {
      return NextResponse.json(
        {
          ok: false,
          error: "not_found",
          message: `Track "${body.trackId.trim()}" was not found.`,
        },
        { status: 404 },
      );
    }

    const { link, created } = await addNoteTrackLink(id, body);
    const trackLinks = await loadSerializedTrackLinks(link.noteId);
    const note = await getNoteById(link.noteId);

    return NextResponse.json(
      {
        ok: true,
        trackLink: serializeNoteTrackLink(link, {
          id: track.track.id,
          title: track.track.title,
          artists: track.artists,
          artworkUrl: track.track.artworkUrl,
        }),
        trackLinks,
        ...(note ? { note: serializeNote(note, trackLinks) } : {}),
      },
      { status: created ? 201 : 200 },
    );
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("add note track link failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to link track to note." },
      { status: 500 },
    );
  }
}
