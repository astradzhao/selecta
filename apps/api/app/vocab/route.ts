import { NextResponse } from "next/server";
import {
  listFolders,
  listGenres,
  listSubgenres,
  type FolderNode,
  type NamedNode,
} from "@selecta/library";

const VOCAB_TYPES = ["genres", "subgenres", "folders"] as const;
type VocabType = (typeof VOCAB_TYPES)[number];

function isVocabType(value: string | null): value is VocabType {
  return value != null && (VOCAB_TYPES as readonly string[]).includes(value);
}

function parseLimit(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * List existing vocab for Library tag editors.
 * GET /vocab?type=genres|subgenres|folders&q=&limit=
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  if (!isVocabType(type)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_type",
        message: `type must be one of: ${VOCAB_TYPES.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  const query = searchParams.get("q") ?? undefined;
  const limit = parseLimit(searchParams.get("limit"));

  try {
    if (type === "genres") {
      const items: NamedNode[] = await listGenres({ query, limit });
      return NextResponse.json({ ok: true, type, items });
    }
    if (type === "subgenres") {
      const items: NamedNode[] = await listSubgenres({ query, limit });
      return NextResponse.json({ ok: true, type, items });
    }
    const items: FolderNode[] = await listFolders({ query, limit });
    return NextResponse.json({ ok: true, type, items });
  } catch (error) {
    console.error("list vocab failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to list vocabulary." },
      { status: 500 },
    );
  }
}
