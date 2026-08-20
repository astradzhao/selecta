import { NextResponse } from "next/server";
import { isPostgresConfigured } from "@selecta/db";
import { getNoteById, listProposals } from "@selecta/submissions";

import { serializeProposals } from "@/lib/proposals";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseVersion(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.floor(value) : undefined;
}

/**
 * List proposals for one submission (defaults to current extraction version).
 * GET /notes/:id/proposals?version=
 */
export async function GET(request: Request, context: RouteContext) {
  if (!isPostgresConfigured()) {
    return NextResponse.json(
      { ok: false, error: "db_not_configured", message: "Postgres is not configured." },
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

  const note = await getNoteById(id);
  if (!note) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: `Note "${id}" was not found.` },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);
  const versionRaw = searchParams.get("version");
  const version = parseVersion(versionRaw) ?? note.extractionVersion;
  if (versionRaw && parseVersion(versionRaw) === undefined) {
    return NextResponse.json(
      { ok: false, error: "invalid_query", message: "version must be a number." },
      { status: 400 },
    );
  }

  try {
    const result = await listProposals({
      noteId: note.id,
      extractionVersion: version,
    });

    return NextResponse.json({
      ok: true,
      proposals: await serializeProposals(result.proposals),
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("list note proposals failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list proposals." },
      { status: 500 },
    );
  }
}
