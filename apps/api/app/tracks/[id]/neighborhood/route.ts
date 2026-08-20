import { NextResponse } from "next/server";
import { getTrackNeighborhood } from "@selecta/library";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Ranked outbound song-graph neighborhood for the M4 explorer.
 * GET /tracks/:id/neighborhood
 *
 * Music store only — no membership or live session lookup.
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
    const neighborhood = await getTrackNeighborhood(id);
    if (!neighborhood) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: `Track "${id}" was not found.` },
        { status: 404 },
      );
    }

    const { current, neighbors } = neighborhood;

    return NextResponse.json({
      ok: true,
      current: {
        id: current.track.id,
        title: current.track.title,
        artists: current.artists,
        genres: current.genres,
        subgenres: current.subgenres,
        folders: current.folders,
        artworkUrl: current.track.artworkUrl,
        durationSec: current.track.durationSec,
        releaseDate: current.track.releaseDate,
        bpm: current.track.bpm,
        musicalKey: current.track.musicalKey,
        energy: current.track.energy,
        externalIds: current.track.externalIds,
        libraryId: current.track.libraryId,
        createdAt: current.track.createdAt,
        updatedAt: current.track.updatedAt,
      },
      neighbors: neighbors.map((neighbor) => ({
        id: neighbor.track.id,
        title: neighbor.track.title,
        artists: neighbor.artists,
        genres: neighbor.genres,
        subgenres: neighbor.subgenres,
        folders: neighbor.folders,
        artworkUrl: neighbor.track.artworkUrl,
        durationSec: neighbor.track.durationSec,
        releaseDate: neighbor.track.releaseDate,
        bpm: neighbor.track.bpm,
        musicalKey: neighbor.track.musicalKey,
        energy: neighbor.track.energy,
        externalIds: neighbor.track.externalIds,
        libraryId: neighbor.track.libraryId,
        createdAt: neighbor.track.createdAt,
        updatedAt: neighbor.track.updatedAt,
        transitions: neighbor.transitions,
      })),
    });
  } catch (error) {
    console.error("get track neighborhood failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to load track neighborhood." },
      { status: 500 },
    );
  }
}
