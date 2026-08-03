import { NextResponse } from "next/server";
import { getNoteById, isNotesError, isPostgresConfigured, removeNoteSongLink } from "@selecta/db";

import { loadSerializedSongLinks, serializeNote } from "@/lib/notes";

type RouteContext = {
  params: Promise<{ id: string; songId: string }>;
};

/**
 * Remove a manual note → song link.
 * DELETE /notes/:id/songs/:songId
 */
export async function DELETE(_request: Request, context: RouteContext) {
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

  const { id, songId } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Note id is required." },
      { status: 400 },
    );
  }
  if (!songId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Song id is required." },
      { status: 400 },
    );
  }

  try {
    await removeNoteSongLink(id, decodeURIComponent(songId));
    const note = await getNoteById(id);
    const songLinks = note ? await loadSerializedSongLinks(note.id) : [];
    return NextResponse.json({
      ok: true,
      songLinks,
      ...(note ? { note: serializeNote(note, songLinks) } : {}),
    });
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("remove note song link failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to unlink song from note." },
      { status: 500 },
    );
  }
}
