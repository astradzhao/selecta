import { and, desc, eq, max } from "drizzle-orm";

import { getDb } from "./client";
import { NotesError } from "./errors";
import { supersedeProposalsForNote } from "./proposals";
import {
  noteAgentRuns,
  notes,
  noteTransitionCommits,
  type Note,
  type NoteAgentRun,
  type NoteAgentRunStatus,
  type NoteExtractionStatus,
  type NoteTransitionCommit,
  type NoteTransitionCommitStatus,
} from "./schema";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
/** UTF-8 byte cap for immutable submission intake (DJ-66). */
export const MAX_SUBMISSION_RAW_BYTES = 64 * 1024;

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
  extractionStatus: Extract<
    NoteExtractionStatus,
    | "no_proposal"
    | "needs_review"
    | "committed"
    | "partially_committed"
    | "commit_failed"
    | "resolving"
    | "failed"
  >;
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
  const bytes = new TextEncoder().encode(trimmed).byteLength;
  if (bytes > MAX_SUBMISSION_RAW_BYTES) {
    throw new NotesError(
      "invalid_input",
      `Submission exceeds max raw size (${bytes} bytes > ${MAX_SUBMISSION_RAW_BYTES} bytes). Shorten the note and retry.`,
    );
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
  await supersedeProposalsForNote(noteId, row.extractionVersion);
  return { note: row, extractionQueued: true };
}

/**
 * Re-queue extraction for a clean retry (manual refresh / failed run).
 * Bumps `extractionVersion` and supersedes prior proposals so retries do not
 * accumulate overlapping spans from older prompt/agent runs.
 */
export async function requeueExtraction(id: string): Promise<Note> {
  const existing = await getNoteById(id);
  if (!existing) {
    throw new NotesError("not_found", `Note "${id}" was not found.`);
  }

  const now = new Date();
  const nextVersion = existing.extractionVersion > 0 ? existing.extractionVersion + 1 : 1;
  const [row] = await getDb()
    .update(notes)
    .set({
      extractionStatus: "extracting",
      extractionVersion: nextVersion,
      extractionStartedAt: now,
      ...clearExtractionFields,
    })
    .where(eq(notes.id, existing.id))
    .returning();

  if (!row) {
    throw new NotesError("not_found", `Note "${id}" was not found.`);
  }
  await supersedeProposalsForNote(row.id, row.extractionVersion);
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

export type StartAgentRunInput = {
  noteId: string;
  extractionVersion: number;
  agentName: string;
  model?: string | null;
  provider?: string | null;
  promptVersion?: string | null;
  promptHash?: string | null;
  workflowRunId?: string | null;
};

export async function startAgentRun(input: StartAgentRunInput): Promise<NoteAgentRun> {
  const attempts = await getDb()
    .select({ maxAttempt: max(noteAgentRuns.attempt) })
    .from(noteAgentRuns)
    .where(
      and(
        eq(noteAgentRuns.noteId, input.noteId),
        eq(noteAgentRuns.extractionVersion, input.extractionVersion),
      ),
    );
  const nextAttempt = (attempts[0]?.maxAttempt ?? 0) + 1;

  const [row] = await getDb()
    .insert(noteAgentRuns)
    .values({
      noteId: input.noteId,
      extractionVersion: input.extractionVersion,
      attempt: nextAttempt,
      agentName: input.agentName,
      status: "running",
      workflowRunId: input.workflowRunId ?? null,
      model: input.model ?? null,
      provider: input.provider ?? null,
      promptVersion: input.promptVersion ?? null,
      promptHash: input.promptHash ?? null,
    })
    .returning();

  if (!row) {
    throw new NotesError("invalid_input", "Failed to start agent run.");
  }
  return row;
}

export async function attachWorkflowRunId(
  runId: string,
  workflowRunId: string,
): Promise<NoteAgentRun | null> {
  const [row] = await getDb()
    .update(noteAgentRuns)
    .set({ workflowRunId })
    .where(eq(noteAgentRuns.id, runId))
    .returning();
  return row ?? null;
}

export type FinishAgentRunInput = {
  status: Extract<NoteAgentRunStatus, "completed" | "failed" | "superseded">;
  stepCount?: number;
  toolCallCount?: number;
  usage?: Record<string, unknown> | null;
  toolSummary?: Record<string, unknown> | null;
  plan?: Record<string, unknown> | null;
  policyResult?: Record<string, unknown> | null;
  error?: string | null;
  model?: string | null;
  provider?: string | null;
  promptVersion?: string | null;
  promptHash?: string | null;
};

export async function finishAgentRun(
  runId: string,
  input: FinishAgentRunInput,
): Promise<NoteAgentRun | null> {
  const [row] = await getDb()
    .update(noteAgentRuns)
    .set({
      status: input.status,
      stepCount: input.stepCount ?? 0,
      toolCallCount: input.toolCallCount ?? 0,
      usage: input.usage ?? null,
      toolSummary: input.toolSummary ?? null,
      plan: input.plan ?? null,
      policyResult: input.policyResult ?? null,
      error: input.error?.slice(0, 2000) ?? null,
      model: input.model ?? undefined,
      provider: input.provider ?? undefined,
      promptVersion: input.promptVersion ?? undefined,
      promptHash: input.promptHash ?? undefined,
      finishedAt: new Date(),
    })
    .where(and(eq(noteAgentRuns.id, runId), eq(noteAgentRuns.status, "running")))
    .returning();
  return row ?? null;
}

export async function listAgentRunsForNote(noteId: string, limit = 10): Promise<NoteAgentRun[]> {
  return getDb()
    .select()
    .from(noteAgentRuns)
    .where(eq(noteAgentRuns.noteId, noteId))
    .orderBy(desc(noteAgentRuns.createdAt))
    .limit(clampLimit(limit));
}

export type UpsertTransitionCommitInput = {
  noteId: string;
  extractionVersion: number;
  proposalKey: string;
  status: NoteTransitionCommitStatus;
  fromTrackId?: string | null;
  toTrackId?: string | null;
  payload?: Record<string, unknown> | null;
  error?: string | null;
};

export async function upsertTransitionCommit(
  input: UpsertTransitionCommitInput,
): Promise<NoteTransitionCommit> {
  const existing = await getDb()
    .select()
    .from(noteTransitionCommits)
    .where(eq(noteTransitionCommits.proposalKey, input.proposalKey))
    .limit(1);

  if (existing[0]) {
    const [row] = await getDb()
      .update(noteTransitionCommits)
      .set({
        status: input.status,
        fromTrackId: input.fromTrackId ?? existing[0].fromTrackId,
        toTrackId: input.toTrackId ?? existing[0].toTrackId,
        payload: input.payload ?? existing[0].payload,
        error: input.error?.slice(0, 2000) ?? null,
        committedAt: input.status === "committed" ? new Date() : existing[0].committedAt,
      })
      .where(eq(noteTransitionCommits.proposalKey, input.proposalKey))
      .returning();
    if (!row) {
      throw new NotesError("invalid_input", "Failed to update transition commit.");
    }
    return row;
  }

  const [row] = await getDb()
    .insert(noteTransitionCommits)
    .values({
      noteId: input.noteId,
      extractionVersion: input.extractionVersion,
      proposalKey: input.proposalKey,
      status: input.status,
      fromTrackId: input.fromTrackId ?? null,
      toTrackId: input.toTrackId ?? null,
      payload: input.payload ?? null,
      error: input.error?.slice(0, 2000) ?? null,
      committedAt: input.status === "committed" ? new Date() : null,
    })
    .returning();
  if (!row) {
    throw new NotesError("invalid_input", "Failed to create transition commit.");
  }
  return row;
}

export async function getTransitionCommitByKey(
  proposalKey: string,
): Promise<NoteTransitionCommit | null> {
  const [row] = await getDb()
    .select()
    .from(noteTransitionCommits)
    .where(eq(noteTransitionCommits.proposalKey, proposalKey))
    .limit(1);
  return row ?? null;
}
