import { and, desc, eq } from "drizzle-orm";

import { getDb } from "./client";
import { NotesError } from "./errors";
import { notes, type Note, type NoteExtractionStatus, type NoteStatus } from "./schema";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type CreateNoteInput = {
  rawText: string;
};

export type UpdateNoteInput = {
  rawText: string;
};

export type ListNotesInput = {
  limit?: number;
};

export type CompleteExtractionInput = {
  extraction: Record<string, unknown>;
  rawResponse: Record<string, unknown> | null;
  model: string;
  provider: string;
  promptVersion: string;
  extractionConfidence: number;
  extractionStatus: Extract<NoteExtractionStatus, "no_proposal" | "resolving">;
  /** Lifecycle status after a successful extract. */
  status: Extract<NoteStatus, "draft" | "preview">;
};

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function requireRawText(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new NotesError("invalid_input", "rawText is required.");
  }
  return trimmed;
}

const clearExtractionFields = {
  extraction: null,
  model: null,
  provider: null,
  promptVersion: null,
  rawResponse: null,
  extractionError: null,
  extractionConfidence: null,
  extractionFinishedAt: null,
} as const;

/**
 * Create a free-form note from raw text and mark extraction as in-flight.
 * Extraction must run after the row is durable (caller schedules it).
 */
export async function createNote(input: CreateNoteInput): Promise<Note> {
  const rawText = requireRawText(input.rawText);
  const now = new Date();
  const [row] = await getDb()
    .insert(notes)
    .values({
      rawText,
      status: "draft",
      extractionStatus: "extracting",
      extractionVersion: 1,
      extractionStartedAt: now,
      ...clearExtractionFields,
    })
    .returning();
  if (!row) {
    throw new NotesError("invalid_input", "Failed to create note.");
  }
  return row;
}

/** List notes newest-first. */
export async function listNotes(input: ListNotesInput = {}): Promise<Note[]> {
  const limit = clampLimit(input.limit);
  return getDb().select().from(notes).orderBy(desc(notes.createdAt)).limit(limit);
}

export async function getNoteById(id: string): Promise<Note | null> {
  const noteId = id.trim();
  if (!noteId) {
    throw new NotesError("invalid_input", "Note id is required.");
  }
  const [row] = await getDb().select().from(notes).where(eq(notes.id, noteId)).limit(1);
  return row ?? null;
}

export type UpdateNoteResult = {
  note: Note;
  /** True when text changed and a new extraction version should run. */
  extractionQueued: boolean;
};

/**
 * Update raw note text.
 * Text changes invalidate uncommitted extraction payloads, bump `extractionVersion`,
 * and mark the note `extracting` for a new async run.
 */
export async function updateNote(id: string, input: UpdateNoteInput): Promise<UpdateNoteResult> {
  const noteId = id.trim();
  if (!noteId) {
    throw new NotesError("invalid_input", "Note id is required.");
  }
  const rawText = requireRawText(input.rawText);

  const existing = await getNoteById(noteId);
  if (!existing) {
    throw new NotesError("not_found", `Note "${noteId}" was not found.`);
  }

  if (existing.rawText === rawText) {
    return { note: existing, extractionQueued: false };
  }

  const now = new Date();
  const [row] = await getDb()
    .update(notes)
    .set({
      rawText,
      status: "draft",
      extractionStatus: "extracting",
      extractionVersion: existing.extractionVersion + 1,
      extractionStartedAt: now,
      ...clearExtractionFields,
    })
    .where(eq(notes.id, noteId))
    .returning();

  if (!row) {
    throw new NotesError("not_found", `Note "${noteId}" was not found.`);
  }
  return { note: row, extractionQueued: true };
}

/**
 * Re-queue extraction for the current note version (retry after failure, or manual refresh).
 * Idempotent for a version: keeps the same `extractionVersion`.
 */
export async function requeueExtraction(id: string): Promise<Note> {
  const existing = await getNoteById(id);
  if (!existing) {
    throw new NotesError("not_found", `Note "${id}" was not found.`);
  }

  const version = existing.extractionVersion > 0 ? existing.extractionVersion : 1;
  const now = new Date();
  const [row] = await getDb()
    .update(notes)
    .set({
      status: existing.status === "committed" ? existing.status : "draft",
      extractionStatus: "extracting",
      extractionVersion: version,
      extractionStartedAt: now,
      extractionError: null,
      extractionFinishedAt: null,
    })
    .where(eq(notes.id, existing.id))
    .returning();

  if (!row) {
    throw new NotesError("not_found", `Note "${id}" was not found.`);
  }
  return row;
}

/**
 * Persist a successful extraction only if `extractionVersion` still matches (CAS).
 * Returns null when a newer edit superseded this run.
 */
export async function completeExtraction(
  id: string,
  version: number,
  input: CompleteExtractionInput,
): Promise<Note | null> {
  const now = new Date();
  const [row] = await getDb()
    .update(notes)
    .set({
      extraction: input.extraction,
      rawResponse: input.rawResponse,
      model: input.model,
      provider: input.provider,
      promptVersion: input.promptVersion,
      extractionConfidence: input.extractionConfidence,
      extractionStatus: input.extractionStatus,
      status: input.status,
      extractionError: null,
      extractionFinishedAt: now,
    })
    .where(
      and(
        eq(notes.id, id),
        eq(notes.extractionVersion, version),
        eq(notes.extractionStatus, "extracting"),
      ),
    )
    .returning();

  return row ?? null;
}

/**
 * Persist an extraction failure only if version still matches and status is extracting.
 */
export async function failExtraction(
  id: string,
  version: number,
  errorMessage: string,
): Promise<Note | null> {
  const now = new Date();
  const [row] = await getDb()
    .update(notes)
    .set({
      extractionStatus: "failed",
      extractionError: errorMessage.slice(0, 2000),
      extractionFinishedAt: now,
    })
    .where(
      and(
        eq(notes.id, id),
        eq(notes.extractionVersion, version),
        eq(notes.extractionStatus, "extracting"),
      ),
    )
    .returning();

  return row ?? null;
}
