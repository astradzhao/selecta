import { NextResponse } from "next/server";
import { isCatalogError, searchCatalog } from "@selecta/catalog";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parseLimit(raw: string | null): number | undefined {
  if (raw == null || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

/**
 * External catalog track search (no persistence).
 * GET /catalog/search?q=...&limit=20
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = parseLimit(searchParams.get("limit")) ?? DEFAULT_LIMIT;

  try {
    const result = await searchCatalog(q, { limit });
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      query: result.query,
      results: result.results,
    });
  } catch (error) {
    if (isCatalogError(error)) {
      if (error.code === "invalid_query") {
        return NextResponse.json(
          {
            ok: false,
            error: "invalid_query",
            message: error.message,
          },
          { status: 400 },
        );
      }

      if (error.code === "not_configured") {
        return NextResponse.json(
          {
            ok: false,
            error: "provider_not_configured",
            provider: error.provider,
            message: error.message,
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          error: "provider_unavailable",
          provider: error.provider,
          message: error.message,
        },
        { status: 502 },
      );
    }

    console.error("catalog search failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "provider_unavailable",
        message: "Catalog search failed unexpectedly.",
      },
      { status: 502 },
    );
  }
}
