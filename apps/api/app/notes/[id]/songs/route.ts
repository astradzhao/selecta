import { NextResponse } from "next/server";
import { addNoteSongLink, getNoteById, isNotesError, isPostgresConfigured } from "@selecta/db";
import { getSongById, isNeo4jConfigured } from "@selecta/graph";

import { loadSerializedSongLinks, serializeNote, serializeNoteSongLink } from "@/lib/notes";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBody(value: unknown): { songId: string; role?: string | null } {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  if (typeof value.songId !== "string") {
    throw new Error("songId must be a string.");
  }
  if (value.role !== undefined && value.role !== null && typeof value.role !== "string") {
    throw new Error("role must be a string or null.");
  }
  return {
    songId: value.songId,
    role: value.role === undefined ? undefined : value.role,
  };
}

/**
 * List manual song links for a note.
 * GET /notes/:id/songs
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
    const songLinks = await loadSerializedSongLinks(note.id);
    return NextResponse.json({ ok: true, songLinks });
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("list note song links failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list note song links." },
      { status: 500 },
    );
  }
}

/**
 * Manually link an existing Neo4j song to a note (explicit user action only).
 * POST /notes/:id/songs
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

  let body: { songId: string; role?: string | null };
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
    const song = await getSongById(body.songId);
    if (!song) {
      return NextResponse.json(
        {
          ok: false,
          error: "not_found",
          message: `Song "${body.songId.trim()}" was not found.`,
        },
        { status: 404 },
      );
    }

    const { link, created } = await addNoteSongLink(id, body);
    const songLinks = await loadSerializedSongLinks(link.noteId);
    const note = await getNoteById(link.noteId);

    return NextResponse.json(
      {
        ok: true,
        songLink: serializeNoteSongLink(link, {
          id: song.song.id,
          title: song.song.title,
          artists: song.artists,
          artworkUrl: song.song.artworkUrl,
        }),
        songLinks,
        ...(note ? { note: serializeNote(note, songLinks) } : {}),
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
    console.error("add note song link failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to link song to note." },
      { status: 500 },
    );
  }
}
