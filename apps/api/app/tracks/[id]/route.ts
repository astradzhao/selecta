import { NextResponse } from "next/server";
import { getTrackById, isNeo4jConfigured } from "@selecta/graph";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Track detail: properties, artists, genres, Subgenres, Folders, transition presence.
 * GET /tracks/:id
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
      track: {
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
      },
    });
  } catch (error) {
    console.error("get track failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to load track." },
      { status: 500 },
    );
  }
}
