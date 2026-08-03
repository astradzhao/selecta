import { NextResponse } from "next/server";
import {
  createSong,
  isGraphWriteError,
  isNeo4jConfigured,
  type CreateSongInput,
  type CreateSongResult,
  type FolderRef,
  type NamedRef,
} from "@selecta/graph";
import { CATALOG_PROVIDERS, type CatalogProviderId } from "@selecta/catalog";

type CatalogImportBody = {
  provider: string;
  providerId: string;
  title: string;
  artists: string[];
  artworkUrl?: string | null;
  durationMs?: number | null;
  releaseDate?: string | null;
  genres?: string[];
};

type CreateSongRequestBody = {
  /** Selected external-catalog hit (DJ-53). */
  catalog?: CatalogImportBody;
  title?: string;
  artists?: string[];
  /** Optional provider Genre names. */
  genres?: string[];
  /** Optional DJ Subgenre refs — never mixed with folders. */
  subgenres?: NamedRef[];
  /** Optional Folder refs — never mixed with subgenres. */
  folders?: FolderRef[];
  artworkUrl?: string | null;
  durationSec?: number | null;
  durationMs?: number | null;
  releaseDate?: string | null;
  bpm?: number | null;
  musicalKey?: string | null;
  energy?: number | null;
};

const catalogProviderSet: ReadonlySet<string> = new Set(CATALOG_PROVIDERS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error("Expected an array of strings.");
  }
  return value;
}

function asNamedRefs(value: unknown, field: string): NamedRef[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`${field}[${index}] must be an object.`);
    }
    const id = item.id;
    const name = item.name;
    if (id !== undefined && typeof id !== "string") {
      throw new Error(`${field}[${index}].id must be a string.`);
    }
    if (name !== undefined && typeof name !== "string") {
      throw new Error(`${field}[${index}].name must be a string.`);
    }
    return {
      ...(typeof id === "string" ? { id } : {}),
      ...(typeof name === "string" ? { name } : {}),
    };
  });
}

function asFolderRefs(value: unknown): FolderRef[] | undefined {
  const refs = asNamedRefs(value, "folders");
  if (!refs || !Array.isArray(value)) {
    return refs;
  }
  return value.map((item, index) => {
    const base = refs[index]!;
    if (!isRecord(item)) {
      return base;
    }
    const kind = item.kind;
    if (kind !== undefined && typeof kind !== "string") {
      throw new Error(`folders[${index}].kind must be a string.`);
    }
    return {
      ...base,
      ...(typeof kind === "string" ? { kind: kind as FolderRef["kind"] } : {}),
    };
  });
}

function asOptionalNumber(value: unknown, field: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number.`);
  }
  return value;
}

function asOptionalString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  return value;
}

function parseCatalog(value: unknown): CatalogImportBody | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error("catalog must be an object.");
  }
  const { provider, providerId, title, artists, artworkUrl, durationMs, releaseDate, genres } =
    value;
  if (typeof provider !== "string" || !provider.trim()) {
    throw new Error("catalog.provider is required.");
  }
  if (!catalogProviderSet.has(provider)) {
    throw new Error(`Unsupported catalog provider "${provider}".`);
  }
  if (typeof providerId !== "string" || !providerId.trim()) {
    throw new Error("catalog.providerId is required.");
  }
  if (typeof title !== "string" || !title.trim()) {
    throw new Error("catalog.title is required.");
  }
  const artistNames = asStringArray(artists);
  if (!artistNames?.length) {
    throw new Error("catalog.artists must include at least one artist.");
  }
  return {
    provider,
    providerId,
    title,
    artists: artistNames,
    artworkUrl: asOptionalString(artworkUrl, "catalog.artworkUrl") ?? null,
    durationMs: asOptionalNumber(durationMs, "catalog.durationMs") ?? null,
    releaseDate: asOptionalString(releaseDate, "catalog.releaseDate") ?? null,
    genres: asStringArray(genres),
  };
}

function parseBody(value: unknown): CreateSongRequestBody {
  if (!isRecord(value)) {
    throw new Error("JSON body must be an object.");
  }
  return {
    catalog: parseCatalog(value.catalog),
    title: asOptionalString(value.title, "title") ?? undefined,
    artists: asStringArray(value.artists),
    genres: asStringArray(value.genres),
    subgenres: asNamedRefs(value.subgenres, "subgenres"),
    folders: asFolderRefs(value.folders),
    artworkUrl: asOptionalString(value.artworkUrl, "artworkUrl"),
    durationSec: asOptionalNumber(value.durationSec, "durationSec"),
    durationMs: asOptionalNumber(value.durationMs, "durationMs"),
    releaseDate: asOptionalString(value.releaseDate, "releaseDate"),
    bpm: asOptionalNumber(value.bpm, "bpm"),
    musicalKey: asOptionalString(value.musicalKey, "musicalKey"),
    energy: asOptionalNumber(value.energy, "energy"),
  };
}

function toCreateInput(body: CreateSongRequestBody): CreateSongInput {
  const catalog = body.catalog;
  const title = (body.title ?? catalog?.title ?? "").trim();
  const artists = (body.artists ?? catalog?.artists ?? [])
    .map((name) => name.trim())
    .filter(Boolean);

  if (!title) {
    throw new Error("title is required (or provide catalog.title).");
  }
  if (artists.length === 0) {
    throw new Error("At least one artist is required (or provide catalog.artists).");
  }

  const genres = [...(catalog?.genres ?? []), ...(body.genres ?? [])]
    .map((name) => name.trim())
    .filter(Boolean);

  const durationSec =
    body.durationSec ??
    (body.durationMs != null ? body.durationMs / 1000 : undefined) ??
    (catalog?.durationMs != null ? catalog.durationMs / 1000 : null);

  const externalIds =
    catalog != null ? { [catalog.provider as CatalogProviderId]: catalog.providerId } : undefined;

  return {
    title,
    artists,
    genres: genres.length ? [...new Set(genres)] : undefined,
    subgenres: body.subgenres,
    folders: body.folders,
    externalIds,
    artworkUrl: body.artworkUrl ?? catalog?.artworkUrl ?? null,
    durationSec: durationSec ?? null,
    releaseDate: body.releaseDate ?? catalog?.releaseDate ?? null,
    bpm: body.bpm ?? null,
    musicalKey: body.musicalKey ?? null,
    energy: body.energy ?? null,
    libraryId: process.env.DEV_LIBRARY_ID?.trim() || null,
  };
}

function serializeSong(result: CreateSongResult) {
  return {
    id: result.song.id,
    title: result.song.title,
    artists: result.artists,
    genres: result.genres,
    subgenres: result.subgenres,
    folders: result.folders,
    artworkUrl: result.song.artworkUrl,
    durationSec: result.song.durationSec,
    releaseDate: result.song.releaseDate,
    bpm: result.song.bpm,
    musicalKey: result.song.musicalKey,
    energy: result.song.energy,
    externalIds: result.song.externalIds,
    libraryId: result.song.libraryId,
    createdAt: result.song.createdAt,
    updatedAt: result.song.updatedAt,
    created: result.created,
  };
}

/**
 * Import a catalog hit or manually create a song.
 * POST /songs
 */
export async function POST(request: Request) {
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  let input: CreateSongInput;
  try {
    input = toCreateInput(parseBody(json));
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
        message: error instanceof Error ? error.message : "Invalid request body.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createSong(input);
    return NextResponse.json(
      { ok: true, song: serializeSong(result) },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    if (isGraphWriteError(error)) {
      const status = error.code === "not_found" ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status },
      );
    }
    console.error("create song failed", error);
    return NextResponse.json(
      { ok: false, error: "internal_error", message: "Failed to create song." },
      { status: 500 },
    );
  }
}
