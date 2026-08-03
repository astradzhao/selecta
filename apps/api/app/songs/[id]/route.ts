import { NextResponse } from "next/server";
import { getSongById, isNeo4jConfigured } from "@selecta/graph";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Song detail: properties, artists, genres, Subgenres, Folders, transition presence.
 * GET /songs/:id
 */
export async function GET(_request: Request, context: RouteContext) {
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
      { ok: false, error: "invalid_id", message: "Song id is required." },
      { status: 400 },
    );
  }

  try {
    const detail = await getSongById(id);
    if (!detail) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: `Song "${id}" was not found.` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      song: {
        id: detail.song.id,
        title: detail.song.title,
        artists: detail.artists,
        genres: detail.genres,
        subgenres: detail.subgenres,
        folders: detail.folders,
        artworkUrl: detail.song.artworkUrl,
        durationSec: detail.song.durationSec,
        releaseDate: detail.song.releaseDate,
        bpm: detail.song.bpm,
        musicalKey: detail.song.musicalKey,
        energy: detail.song.energy,
        externalIds: detail.song.externalIds,
        libraryId: detail.song.libraryId,
        createdAt: detail.song.createdAt,
        updatedAt: detail.song.updatedAt,
        hasOutboundTransitions: detail.hasOutboundTransitions,
        hasInboundTransitions: detail.hasInboundTransitions,
      },
    });
  } catch (error) {
    console.error("get song failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to load song." },
      { status: 500 },
    );
  }
}
