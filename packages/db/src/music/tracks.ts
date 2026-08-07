import { and, asc, desc, eq, exists, gte, inArray, lte, max, or, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDb } from "../client";
import * as schema from "../schema";
import {
  artists,
  folders,
  genres,
  subgenres,
  trackArtists,
  trackExternalIds,
  trackFolders,
  trackGenres,
  trackSubgenres,
  tracks,
  transitions,
  type Track,
} from "../schema";
import { MusicWriteError } from "./errors";
import { clampListLimit, clampListOffset } from "./list-page";
import { toFolderNode, toNamedNode, toTrackNode } from "./mappers";
import { normalizeName } from "./normalize";
import { cleanExternalIds, optionalNumber, requireTrimmed } from "./shared";
import type {
  CreateTrackInput,
  CreateTrackResult,
  LibraryStats,
  ListSortOrder,
  ListTracksInput,
  ListTracksResult,
  TrackDetail,
  TrackSortField,
  TrackSummary,
} from "./types";
import {
  ensureArtist,
  ensureFolder,
  ensureGenre,
  ensureSubgenre,
  resolveFolderRef,
  resolveSubgenreRef,
} from "./vocab";

type DbLike = NodePgDatabase<typeof schema>;

function db(): DbLike {
  return getDb();
}

async function loadExternalIdMaps(
  executor: DbLike,
  trackIds: string[],
): Promise<Map<string, Record<string, string>>> {
  const map = new Map<string, Record<string, string>>();
  if (trackIds.length === 0) {
    return map;
  }
  const rows = await executor
    .select()
    .from(trackExternalIds)
    .where(inArray(trackExternalIds.trackId, trackIds));
  for (const row of rows) {
    const existing = map.get(row.trackId) ?? {};
    existing[row.provider] = row.providerId;
    map.set(row.trackId, existing);
  }
  return map;
}

async function loadSummariesForTracks(
  executor: DbLike,
  trackRows: Track[],
): Promise<TrackSummary[]> {
  if (trackRows.length === 0) {
    return [];
  }
  const trackIds = trackRows.map((t) => t.id);
  const extMaps = await loadExternalIdMaps(executor, trackIds);
  const artistRows = await executor
    .select({
      trackId: trackArtists.trackId,
      id: artists.id,
      name: artists.name,
      nameNormalized: artists.nameNormalized,
    })
    .from(trackArtists)
    .innerJoin(artists, eq(trackArtists.artistId, artists.id))
    .where(inArray(trackArtists.trackId, trackIds));
  const genreRows = await executor
    .select({
      trackId: trackGenres.trackId,
      id: genres.id,
      name: genres.name,
      nameNormalized: genres.nameNormalized,
    })
    .from(trackGenres)
    .innerJoin(genres, eq(trackGenres.genreId, genres.id))
    .where(inArray(trackGenres.trackId, trackIds));
  const subgenreRows = await executor
    .select({
      trackId: trackSubgenres.trackId,
      id: subgenres.id,
      name: subgenres.name,
      nameNormalized: subgenres.nameNormalized,
    })
    .from(trackSubgenres)
    .innerJoin(subgenres, eq(trackSubgenres.subgenreId, subgenres.id))
    .where(inArray(trackSubgenres.trackId, trackIds));
  const folderRows = await executor
    .select({
      trackId: trackFolders.trackId,
      id: folders.id,
      name: folders.name,
      nameNormalized: folders.nameNormalized,
      kind: folders.kind,
    })
    .from(trackFolders)
    .innerJoin(folders, eq(trackFolders.folderId, folders.id))
    .where(inArray(trackFolders.trackId, trackIds));

  const artistsByTrack = new Map<string, ReturnType<typeof toNamedNode>[]>();
  for (const row of artistRows) {
    const list = artistsByTrack.get(row.trackId) ?? [];
    list.push(toNamedNode(row));
    artistsByTrack.set(row.trackId, list);
  }
  const genresByTrack = new Map<string, ReturnType<typeof toNamedNode>[]>();
  for (const row of genreRows) {
    const list = genresByTrack.get(row.trackId) ?? [];
    list.push(toNamedNode(row));
    genresByTrack.set(row.trackId, list);
  }
  const subgenresByTrack = new Map<string, ReturnType<typeof toNamedNode>[]>();
  for (const row of subgenreRows) {
    const list = subgenresByTrack.get(row.trackId) ?? [];
    list.push(toNamedNode(row));
    subgenresByTrack.set(row.trackId, list);
  }
  const foldersByTrack = new Map<string, ReturnType<typeof toFolderNode>[]>();
  for (const row of folderRows) {
    const list = foldersByTrack.get(row.trackId) ?? [];
    list.push(toFolderNode(row));
    foldersByTrack.set(row.trackId, list);
  }

  return trackRows.map((row) => ({
    track: toTrackNode(row, extMaps.get(row.id) ?? {}),
    artists: artistsByTrack.get(row.id) ?? [],
    genres: genresByTrack.get(row.id) ?? [],
    subgenres: subgenresByTrack.get(row.id) ?? [],
    folders: foldersByTrack.get(row.id) ?? [],
  }));
}

async function loadSummaryById(executor: DbLike, trackId: string): Promise<TrackSummary | null> {
  const [row] = await executor.select().from(tracks).where(eq(tracks.id, trackId)).limit(1);
  if (!row) {
    return null;
  }
  const [summary] = await loadSummariesForTracks(executor, [row]);
  return summary ?? null;
}

/** Batch-load track summaries by id (order follows first occurrence of each id). */
export async function getTrackSummariesByIds(ids: string[]): Promise<Map<string, TrackSummary>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, TrackSummary>();
  if (unique.length === 0) {
    return map;
  }
  const rows = await db().select().from(tracks).where(inArray(tracks.id, unique));
  const summaries = await loadSummariesForTracks(db(), rows);
  for (const summary of summaries) {
    map.set(summary.track.id, summary);
  }
  return map;
}

/**
 * Create a track (or reuse one matched by external provider id) and wire
 * artist / genre / subgenre / folder relationships.
 */
export async function createTrack(input: CreateTrackInput): Promise<CreateTrackResult> {
  const title = requireTrimmed(input.title, "Title");
  const artistNames = (input.artists ?? []).map((name) => name.trim()).filter(Boolean);
  if (artistNames.length === 0) {
    throw new MusicWriteError("invalid_input", "At least one artist is required.");
  }

  const externalIds = cleanExternalIds(input.externalIds);
  const externalEntries = Object.entries(externalIds);
  const durationSec = optionalNumber(input.durationSec);

  return db().transaction(async (tx) => {
    const executor = tx as unknown as DbLike;

    const subgenreParams = [];
    for (const [index, ref] of (input.subgenres ?? []).entries()) {
      subgenreParams.push(await resolveSubgenreRef(ref, `subgenres[${index}]`, executor));
    }
    const folderParams = [];
    for (const [index, ref] of (input.folders ?? []).entries()) {
      folderParams.push(await resolveFolderRef(ref, index, executor));
    }

    let trackId: string;
    let created: boolean;

    let existingId: string | null = null;
    if (externalEntries.length > 0) {
      const conditions = externalEntries.map(([provider, providerId]) =>
        and(eq(trackExternalIds.provider, provider), eq(trackExternalIds.providerId, providerId)),
      );
      const [hit] = await executor
        .select({ trackId: trackExternalIds.trackId })
        .from(trackExternalIds)
        .where(or(...conditions)!)
        .limit(1);
      existingId = hit?.trackId ?? null;
    }

    if (existingId) {
      trackId = existingId;
      created = false;
      const [existing] = await executor
        .select()
        .from(tracks)
        .where(eq(tracks.id, trackId))
        .limit(1);
      if (!existing) {
        throw new MusicWriteError("not_found", `Track id "${trackId}" was not found.`);
      }
      // Graph parity: coalesce($incoming, existing) — prefer non-null incoming, else keep.
      await executor
        .update(tracks)
        .set({
          title,
          artworkUrl: input.artworkUrl ?? existing.artworkUrl,
          durationSec: durationSec ?? existing.durationSec,
          releaseDate: input.releaseDate ?? existing.releaseDate,
          bpm: input.bpm ?? existing.bpm,
          musicalKey: input.musicalKey ?? existing.musicalKey,
          energy: input.energy ?? existing.energy,
          libraryId: input.libraryId ?? existing.libraryId,
          updatedAt: new Date(),
        })
        .where(eq(tracks.id, trackId));

      if (externalEntries.length > 0) {
        await executor
          .insert(trackExternalIds)
          .values(
            externalEntries.map(([provider, providerId]) => ({
              trackId,
              provider,
              providerId,
            })),
          )
          .onConflictDoNothing();
      }
    } else {
      trackId = randomUUID();
      created = true;
      await executor.insert(tracks).values({
        id: trackId,
        title,
        bpm: input.bpm ?? null,
        musicalKey: input.musicalKey ?? null,
        durationSec,
        energy: input.energy ?? null,
        artworkUrl: input.artworkUrl ?? null,
        releaseDate: input.releaseDate ?? null,
        libraryId: input.libraryId ?? null,
      });
      if (externalEntries.length > 0) {
        await executor.insert(trackExternalIds).values(
          externalEntries.map(([provider, providerId]) => ({
            trackId,
            provider,
            providerId,
          })),
        );
      }
    }

    const ensuredArtists: Awaited<ReturnType<typeof ensureArtist>>[] = [];
    for (const name of artistNames) {
      ensuredArtists.push(await ensureArtist(name, executor));
    }
    const ensuredGenres: Awaited<ReturnType<typeof ensureGenre>>[] = [];
    for (const name of (input.genres ?? []).map((n) => n.trim()).filter(Boolean)) {
      ensuredGenres.push(await ensureGenre(name, executor));
    }
    const ensuredSubgenres: Awaited<ReturnType<typeof ensureSubgenre>>[] = [];
    for (const params of subgenreParams) {
      ensuredSubgenres.push(await ensureSubgenre(params.name, executor));
    }
    const ensuredFolders: Awaited<ReturnType<typeof ensureFolder>>[] = [];
    for (const params of folderParams) {
      ensuredFolders.push(
        await ensureFolder({ name: params.name, kind: params.kind ?? undefined }, executor),
      );
    }

    if (ensuredArtists.length > 0) {
      await executor
        .insert(trackArtists)
        .values(ensuredArtists.map((a) => ({ trackId, artistId: a.id })))
        .onConflictDoNothing();
    }
    if (ensuredGenres.length > 0) {
      await executor
        .insert(trackGenres)
        .values(ensuredGenres.map((g) => ({ trackId, genreId: g.id })))
        .onConflictDoNothing();
    }
    if (ensuredSubgenres.length > 0) {
      await executor
        .insert(trackSubgenres)
        .values(ensuredSubgenres.map((s) => ({ trackId, subgenreId: s.id })))
        .onConflictDoNothing();
    }
    if (ensuredFolders.length > 0) {
      await executor
        .insert(trackFolders)
        .values(ensuredFolders.map((f) => ({ trackId, folderId: f.id })))
        .onConflictDoNothing();
    }

    const summary = await loadSummaryById(executor, trackId);
    if (!summary) {
      throw new MusicWriteError("not_found", "Failed to load created track.");
    }
    return { ...summary, created };
  });
}

function parseBound(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildListWhere(
  executor: DbLike,
  input: {
    queryNormalized: string;
    subgenreId: string | null;
    subgenreNormalized: string | null;
    folderId: string | null;
    folderNormalized: string | null;
    createdAfter: Date | null;
    createdBefore: Date | null;
    updatedAfter: Date | null;
    updatedBefore: Date | null;
  },
): SQL | undefined {
  const parts: SQL[] = [];

  if (input.queryNormalized) {
    const pattern = `%${input.queryNormalized}%`;
    parts.push(
      or(
        sql`lower(${tracks.title}) like ${pattern}`,
        exists(
          executor
            .select({ one: sql`1` })
            .from(trackArtists)
            .innerJoin(artists, eq(trackArtists.artistId, artists.id))
            .where(
              and(eq(trackArtists.trackId, tracks.id), sql`lower(${artists.name}) like ${pattern}`),
            ),
        ),
      )!,
    );
  }

  if (input.subgenreId) {
    parts.push(
      exists(
        executor
          .select({ one: sql`1` })
          .from(trackSubgenres)
          .where(
            and(
              eq(trackSubgenres.trackId, tracks.id),
              eq(trackSubgenres.subgenreId, input.subgenreId),
            ),
          ),
      ),
    );
  }
  if (input.subgenreNormalized) {
    parts.push(
      exists(
        executor
          .select({ one: sql`1` })
          .from(trackSubgenres)
          .innerJoin(subgenres, eq(trackSubgenres.subgenreId, subgenres.id))
          .where(
            and(
              eq(trackSubgenres.trackId, tracks.id),
              eq(subgenres.nameNormalized, input.subgenreNormalized),
            ),
          ),
      ),
    );
  }
  if (input.folderId) {
    parts.push(
      exists(
        executor
          .select({ one: sql`1` })
          .from(trackFolders)
          .where(
            and(eq(trackFolders.trackId, tracks.id), eq(trackFolders.folderId, input.folderId)),
          ),
      ),
    );
  }
  if (input.folderNormalized) {
    parts.push(
      exists(
        executor
          .select({ one: sql`1` })
          .from(trackFolders)
          .innerJoin(folders, eq(trackFolders.folderId, folders.id))
          .where(
            and(
              eq(trackFolders.trackId, tracks.id),
              eq(folders.nameNormalized, input.folderNormalized),
            ),
          ),
      ),
    );
  }
  if (input.createdAfter) {
    parts.push(gte(tracks.createdAt, input.createdAfter));
  }
  if (input.createdBefore) {
    parts.push(lte(tracks.createdAt, input.createdBefore));
  }
  if (input.updatedAfter) {
    parts.push(gte(tracks.updatedAt, input.updatedAfter));
  }
  if (input.updatedBefore) {
    parts.push(lte(tracks.updatedAt, input.updatedBefore));
  }

  if (parts.length === 0) {
    return undefined;
  }
  return parts.length === 1 ? parts[0] : and(...parts);
}

function trackOrderBy(sort: TrackSortField, order: ListSortOrder) {
  const titleAsc = asc(sql`lower(${tracks.title})`);
  const idAsc = asc(tracks.id);
  const dir = order === "desc" ? desc : asc;
  switch (sort) {
    case "createdAt":
      return [dir(tracks.createdAt), titleAsc, idAsc];
    case "updatedAt":
      return [dir(tracks.updatedAt), titleAsc, idAsc];
    case "title":
    default:
      return [order === "desc" ? desc(sql`lower(${tracks.title})`) : titleAsc, idAsc];
  }
}

export async function listTracks(input: ListTracksInput = {}): Promise<ListTracksResult> {
  const query = input.query?.trim() ?? "";
  const queryNormalized = query ? normalizeName(query) : "";
  const subgenreId = input.subgenreId?.trim() || null;
  const subgenreNormalized = input.subgenre?.trim() ? normalizeName(input.subgenre) : null;
  const folderId = input.folderId?.trim() || null;
  const folderNormalized = input.folder?.trim() ? normalizeName(input.folder) : null;
  const createdAfter = parseBound(input.createdAfter?.trim() || null);
  const createdBefore = parseBound(input.createdBefore?.trim() || null);
  const updatedAfter = parseBound(input.updatedAfter?.trim() || null);
  const updatedBefore = parseBound(input.updatedBefore?.trim() || null);
  const sort: TrackSortField =
    input.sort === "createdAt" || input.sort === "updatedAt" || input.sort === "title"
      ? input.sort
      : "title";
  const order: ListSortOrder = input.order === "desc" ? "desc" : "asc";
  const limit = clampListLimit(input.limit);
  const offset = clampListOffset(input.offset);
  const fetchLimit = limit + 1;

  const executor = db();
  const where = buildListWhere(executor, {
    queryNormalized,
    subgenreId,
    subgenreNormalized,
    folderId,
    folderNormalized,
    createdAfter,
    createdBefore,
    updatedAfter,
    updatedBefore,
  });

  const rows = await executor
    .select()
    .from(tracks)
    .where(where)
    .orderBy(...trackOrderBy(sort, order))
    .limit(fetchLimit)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const summaries = await loadSummariesForTracks(executor, page);

  return {
    tracks: summaries,
    limit,
    offset,
    hasMore,
  };
}

export async function getLibraryStats(): Promise<LibraryStats> {
  const [row] = await db()
    .select({
      count: sql<number>`count(*)::int`,
      latestUpdatedAt: max(tracks.updatedAt),
    })
    .from(tracks);

  return {
    count: row?.count ?? 0,
    latestUpdatedAt: row?.latestUpdatedAt ? row.latestUpdatedAt.toISOString() : null,
  };
}

export async function getTrackById(id: string): Promise<TrackDetail | null> {
  const trackId = id.trim();
  if (!trackId) {
    return null;
  }

  const executor = db();
  const [row] = await executor
    .select({
      track: tracks,
      hasOutboundTransitions: sql<boolean>`exists(
        select 1 from ${transitions}
        where ${transitions.fromTrackId} = ${tracks.id}
      )`,
      hasInboundTransitions: sql<boolean>`exists(
        select 1 from ${transitions}
        where ${transitions.toTrackId} = ${tracks.id}
      )`,
    })
    .from(tracks)
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!row) {
    return null;
  }

  const [summary] = await loadSummariesForTracks(executor, [row.track]);
  if (!summary) {
    return null;
  }

  return {
    ...summary,
    hasOutboundTransitions: Boolean(row.hasOutboundTransitions),
    hasInboundTransitions: Boolean(row.hasInboundTransitions),
  };
}

/**
 * Exact track lookup by provider external id.
 * Throws `invalid_input` when provider is empty or contains `:`.
 */
export async function getTrackByExternalId(
  provider: string,
  providerId: string,
): Promise<TrackSummary | null> {
  const providerKey = provider.trim().toLowerCase();
  const id = providerId.trim();
  if (!providerKey || providerKey.includes(":")) {
    throw new MusicWriteError(
      "invalid_input",
      `External id provider must be non-empty and must not contain ":".`,
    );
  }
  if (!id) {
    throw new MusicWriteError("invalid_input", "External id providerId must not be empty.");
  }

  const executor = db();
  const [hit] = await executor
    .select({ trackId: trackExternalIds.trackId })
    .from(trackExternalIds)
    .where(and(eq(trackExternalIds.provider, providerKey), eq(trackExternalIds.providerId, id)))
    .limit(1);

  if (!hit) {
    return null;
  }
  return loadSummaryById(executor, hit.trackId);
}
