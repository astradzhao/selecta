import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getDb } from "../client";
import * as schema from "../schema";
import { artists, folders, genres, subgenres } from "../schema";
import { MusicWriteError } from "./errors";
import { toFolderNode, toNamedNode } from "./mappers";
import { normalizeName } from "./normalize";
import { prepareVocab, requireTrimmed, type VocabParams } from "./shared";
import {
  assertFolderKind,
  type FolderNode,
  type FolderRef,
  type NamedNode,
  type NamedRef,
} from "./types";

type DbLike = NodePgDatabase<typeof schema>;

async function selectArtistByNormalized(db: DbLike, nameNormalized: string): Promise<NamedNode> {
  const [row] = await db
    .select()
    .from(artists)
    .where(eq(artists.nameNormalized, nameNormalized))
    .limit(1);
  if (!row) {
    throw new MusicWriteError("not_found", "Failed to ensure Artist.");
  }
  return toNamedNode(row);
}

async function selectGenreByNormalized(db: DbLike, nameNormalized: string): Promise<NamedNode> {
  const [row] = await db
    .select()
    .from(genres)
    .where(eq(genres.nameNormalized, nameNormalized))
    .limit(1);
  if (!row) {
    throw new MusicWriteError("not_found", "Failed to ensure Genre.");
  }
  return toNamedNode(row);
}

async function selectSubgenreByNormalized(
  db: DbLike,
  nameNormalized: string,
): Promise<NamedNode> {
  const [row] = await db
    .select()
    .from(subgenres)
    .where(eq(subgenres.nameNormalized, nameNormalized))
    .limit(1);
  if (!row) {
    throw new MusicWriteError("not_found", "Failed to ensure Subgenre.");
  }
  return toNamedNode(row);
}

async function selectFolderByNormalized(db: DbLike, nameNormalized: string): Promise<FolderNode> {
  const [row] = await db
    .select()
    .from(folders)
    .where(eq(folders.nameNormalized, nameNormalized))
    .limit(1);
  if (!row) {
    throw new MusicWriteError("not_found", "Failed to ensure Folder.");
  }
  return toFolderNode(row);
}

/** INSERT … ON CONFLICT (name_normalized) DO NOTHING; does not update display name. */
export async function ensureArtist(name: string, db: DbLike = getDb()): Promise<NamedNode> {
  const vocab = prepareVocab(name, "Artist name");
  await db
    .insert(artists)
    .values({
      id: vocab.id,
      name: vocab.name,
      nameNormalized: vocab.nameNormalized,
    })
    .onConflictDoNothing({ target: artists.nameNormalized });
  return selectArtistByNormalized(db, vocab.nameNormalized);
}

/** INSERT … ON CONFLICT (name_normalized) DO NOTHING; does not update display name. */
export async function ensureGenre(name: string, db: DbLike = getDb()): Promise<NamedNode> {
  const vocab = prepareVocab(name, "Genre name");
  await db
    .insert(genres)
    .values({
      id: vocab.id,
      name: vocab.name,
      nameNormalized: vocab.nameNormalized,
    })
    .onConflictDoNothing({ target: genres.nameNormalized });
  return selectGenreByNormalized(db, vocab.nameNormalized);
}

/** INSERT … ON CONFLICT (name_normalized) DO NOTHING; does not update display name. */
export async function ensureSubgenre(name: string, db: DbLike = getDb()): Promise<NamedNode> {
  const vocab = prepareVocab(name, "Subgenre name");
  await db
    .insert(subgenres)
    .values({
      id: vocab.id,
      name: vocab.name,
      nameNormalized: vocab.nameNormalized,
    })
    .onConflictDoNothing({ target: subgenres.nameNormalized });
  return selectSubgenreByNormalized(db, vocab.nameNormalized);
}

/**
 * INSERT … ON CONFLICT (name_normalized) DO UPDATE kind = COALESCE(new, existing).
 */
export async function ensureFolder(
  input: { name: string; kind?: string },
  db: DbLike = getDb(),
): Promise<FolderNode> {
  const display = requireTrimmed(input.name, "Folder name");
  const kind = assertFolderKind(input.kind) ?? null;
  const nameNormalized = normalizeName(display);
  const id = randomUUID();

  await db
    .insert(folders)
    .values({
      id,
      name: display,
      nameNormalized,
      kind,
    })
    .onConflictDoUpdate({
      target: folders.nameNormalized,
      set: {
        kind: sql`coalesce(excluded.kind, ${folders.kind})`,
        updatedAt: new Date(),
      },
    });

  return selectFolderByNormalized(db, nameNormalized);
}

/** Resolve a Subgenre ref by id and/or name for track linking. */
export async function resolveSubgenreRef(
  ref: NamedRef,
  label: string,
  db: DbLike = getDb(),
): Promise<VocabParams> {
  const id = ref.id?.trim();
  const name = ref.name?.trim();
  if (!id && !name) {
    throw new MusicWriteError("invalid_input", `${label} requires an id or name.`);
  }

  if (id) {
    const [found] = await db.select().from(subgenres).where(eq(subgenres.id, id)).limit(1);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        nameNormalized: found.nameNormalized,
      };
    }
    if (!name) {
      throw new MusicWriteError("not_found", `${label} id "${id}" was not found.`);
    }
  }

  return prepareVocab(name!, label);
}

/** Resolve a Folder ref by id and/or name for track linking. */
export async function resolveFolderRef(
  ref: FolderRef,
  index: number,
  db: DbLike = getDb(),
): Promise<VocabParams & { kind: string | null }> {
  const id = ref.id?.trim();
  const name = ref.name?.trim();
  const kind = assertFolderKind(ref.kind) ?? null;
  if (!id && !name) {
    throw new MusicWriteError("invalid_input", `folders[${index}] requires an id or name.`);
  }

  if (id) {
    const [found] = await db.select().from(folders).where(eq(folders.id, id)).limit(1);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        nameNormalized: found.nameNormalized,
        kind: kind ?? found.kind,
      };
    }
    if (!name) {
      throw new MusicWriteError("not_found", `Folder id "${id}" was not found.`);
    }
  }

  const vocab = prepareVocab(name!, `folders[${index}]`);
  return { ...vocab, kind };
}
