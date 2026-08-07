import { NextResponse } from "next/server";
import { getLibraryStats } from "@selecta/db";

/**
 * Cheap library fingerprint for client cache checks.
 * GET /tracks/stats → { count, latestUpdatedAt }
 */
export async function GET() {
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
