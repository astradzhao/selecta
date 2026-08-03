import { NextResponse } from "next/server";
import { getNoteById, isNotesError, isPostgresConfigured, removeNoteTrackLink } from "@selecta/db";

import { loadSerializedTrackLinks, serializeNote } from "@/lib/notes";

type RouteContext = {
  params: Promise<{ id: string; trackId: string }>;
};

/**
 * Remove a manual note → track link.
 * DELETE /notes/:id/tracks/:trackId
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

  const { id, trackId } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Note id is required." },
      { status: 400 },
    );
  }
  if (!trackId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "invalid_id", message: "Track id is required." },
      { status: 400 },
    );
  }

  try {
    await removeNoteTrackLink(id, decodeURIComponent(trackId));
    const note = await getNoteById(id);
    const trackLinks = note ? await loadSerializedTrackLinks(note.id) : [];
    return NextResponse.json({
      ok: true,
      trackLinks,
      ...(note ? { note: serializeNote(note, trackLinks) } : {}),
    });
  } catch (error) {
    if (isNotesError(error)) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: error.code === "not_found" ? 404 : 400 },
      );
    }
    console.error("remove note track link failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to unlink track from note." },
      { status: 500 },
    );
  }
}
