import { NextResponse } from "next/server";
import { getLibraryStats, isNeo4jConfigured } from "@selecta/graph";

/**
 * Cheap library fingerprint for client cache checks.
 * GET /tracks/stats → { count, latestUpdatedAt }
 */
export async function GET() {
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

  try {
    const stats = await getLibraryStats();
    return NextResponse.json({
      ok: true,
      count: stats.count,
      latestUpdatedAt: stats.latestUpdatedAt,
    });
  } catch (error) {
    console.error("get library stats failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to load library stats." },
      { status: 500 },
    );
  }
}
