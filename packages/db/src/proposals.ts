import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

import { getDb } from "./client";
import { NotesError } from "./errors";
import {
  noteProposals,
  type NoteExtractionStatus,
  type NoteProposal,
  type NoteProposalStatus,
  type NoteStatus,
} from "./schema";

export type ClaimProposalInput = {
  noteId: string;
  extractionVersion: number;
  workflowRunId?: string | null;
  agentRunId?: string | null;
  ordinal: number;
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
  sourceFingerprint: string;
  proposalKey: string;
};

export type ClaimProposalResult = {
  proposal: NoteProposal;
  /** True when this call inserted a new row (false on idempotent replay). */
  created: boolean;
};

/**
 * Idempotently claim a proposal by fingerprint key.
 * Replay-safe: duplicate claims return the existing row without resetting terminal states.
 */
export async function claimProposal(input: ClaimProposalInput): Promise<ClaimProposalResult> {
  const existing = await getProposalByKey(input.proposalKey);
  if (existing) {
    if (
      existing.noteId !== input.noteId ||
      existing.extractionVersion !== input.extractionVersion
    ) {
      throw new NotesError(
        "invalid_input",
        `Proposal key collision for "${input.proposalKey}".`,
      );
    }
    // Do not rewind terminal / in-flight states on replay.
    if (existing.status === "superseded") {
      throw new NotesError(
        "invalid_input",
        `Proposal "${input.proposalKey}" was superseded by a newer extraction version.`,
      );
    }
    return { proposal: existing, created: false };
  }

  try {
    const [row] = await getDb()
      .insert(noteProposals)
      .values({
        noteId: input.noteId,
        extractionVersion: input.extractionVersion,
        workflowRunId: input.workflowRunId ?? null,
        agentRunId: input.agentRunId ?? null,
        ordinal: input.ordinal,
        sourceStart: input.sourceStart,
        sourceEnd: input.sourceEnd,
        sourceText: input.sourceText,
        sourceFingerprint: input.sourceFingerprint,
        proposalKey: input.proposalKey,
        status: "parsing",
        attemptCount: 1,
      })
      .returning();
    if (!row) {
      throw new NotesError("invalid_input", "Failed to claim proposal.");
    }
    return { proposal: row, created: true };
  } catch (error) {
    // Unique race: another worker claimed first — return that row.
    const raced = await getProposalByKey(input.proposalKey);
    if (raced) {
      return { proposal: raced, created: false };
    }
    throw error;
  }
}

export async function getProposalByKey(proposalKey: string): Promise<NoteProposal | null> {
  const [row] = await getDb()
    .select()
    .from(noteProposals)
    .where(eq(noteProposals.proposalKey, proposalKey))
    .limit(1);
  return row ?? null;
}

export async function getProposalById(id: string): Promise<NoteProposal | null> {
  const [row] = await getDb().select().from(noteProposals).where(eq(noteProposals.id, id)).limit(1);
  return row ?? null;
}

export async function listProposalsForVersion(
  noteId: string,
  extractionVersion: number,
): Promise<NoteProposal[]> {
  return getDb()
    .select()
    .from(noteProposals)
    .where(
      and(
        eq(noteProposals.noteId, noteId),
        eq(noteProposals.extractionVersion, extractionVersion),
        ne(noteProposals.status, "superseded"),
      ),
    )
    .orderBy(asc(noteProposals.ordinal), asc(noteProposals.createdAt));
}

export type UpdateProposalInput = {
  status?: NoteProposalStatus;
  draft?: Record<string, unknown> | null;
  resolution?: Record<string, unknown> | null;
  policyResult?: Record<string, unknown> | null;
  reviewReasons?: Array<Record<string, unknown>> | null;
  model?: string | null;
  promptVersion?: string | null;
  usage?: Record<string, unknown> | null;
  attemptCount?: number;
  transitionId?: string | null;
  error?: string | null;
  workflowRunId?: string | null;
  agentRunId?: string | null;
};

export async function updateProposal(
  proposalId: string,
  input: UpdateProposalInput,
): Promise<NoteProposal | null> {
  const [row] = await getDb()
    .update(noteProposals)
    .set({
      status: input.status,
      draft: input.draft === undefined ? undefined : input.draft,
      resolution: input.resolution === undefined ? undefined : input.resolution,
      policyResult: input.policyResult === undefined ? undefined : input.policyResult,
      reviewReasons: input.reviewReasons === undefined ? undefined : input.reviewReasons,
      model: input.model === undefined ? undefined : input.model,
      promptVersion: input.promptVersion === undefined ? undefined : input.promptVersion,
      usage: input.usage === undefined ? undefined : input.usage,
      attemptCount: input.attemptCount,
      transitionId: input.transitionId === undefined ? undefined : input.transitionId,
      error: input.error === undefined ? undefined : input.error?.slice(0, 2000) ?? null,
      workflowRunId: input.workflowRunId === undefined ? undefined : input.workflowRunId,
      agentRunId: input.agentRunId === undefined ? undefined : input.agentRunId,
    })
    .where(eq(noteProposals.id, proposalId))
    .returning();
  return row ?? null;
}

/** Mark proposals from older extraction versions as superseded. */
export async function supersedeProposalsForNote(
  noteId: string,
  exceptVersion: number,
): Promise<number> {
  const result = await getDb()
    .update(noteProposals)
    .set({ status: "superseded" })
    .where(
      and(
        eq(noteProposals.noteId, noteId),
        ne(noteProposals.extractionVersion, exceptVersion),
        inArray(noteProposals.status, [
          "queued",
          "parsing",
          "resolving",
          "ready",
          "needs_review",
          "failed",
        ]),
      ),
    )
    .returning({ id: noteProposals.id });
  return result.length;
}

export type ProposalStatusCounts = {
  total: number;
  queued: number;
  parsing: number;
  resolving: number;
  ready: number;
  needs_review: number;
  committed: number;
  failed: number;
  rejected: number;
  superseded: number;
};

export async function countProposalsForVersion(
  noteId: string,
  extractionVersion: number,
): Promise<ProposalStatusCounts> {
  const rows = await getDb()
    .select({
      status: noteProposals.status,
      count: sql<number>`count(*)::int`,
    })
    .from(noteProposals)
    .where(
      and(eq(noteProposals.noteId, noteId), eq(noteProposals.extractionVersion, extractionVersion)),
    )
    .groupBy(noteProposals.status);

  const counts: ProposalStatusCounts = {
    total: 0,
    queued: 0,
    parsing: 0,
    resolving: 0,
    ready: 0,
    needs_review: 0,
    committed: 0,
    failed: 0,
    rejected: 0,
    superseded: 0,
  };

  for (const row of rows) {
    const n = Number(row.count) || 0;
    counts.total += n;
    counts[row.status] = n;
  }
  return counts;
}

/**
 * Derive submission-level extraction status from per-proposal counts.
 * Partial success is first-class: committed siblings are not blocked by review/failed ones.
 */
export function deriveSubmissionExtractionStatus(
  counts: ProposalStatusCounts,
): {
  extractionStatus: Extract<
    NoteExtractionStatus,
    | "no_proposal"
    | "needs_review"
    | "committed"
    | "partially_committed"
    | "commit_failed"
    | "failed"
    | "resolving"
  >;
  noteStatus: Extract<NoteStatus, "draft" | "preview" | "committed">;
} {
  const inFlight = counts.queued + counts.parsing + counts.resolving + counts.ready;
  const decided = counts.committed + counts.needs_review + counts.failed + counts.rejected;

  if (inFlight > 0 && decided === 0) {
    return { extractionStatus: "resolving", noteStatus: "draft" };
  }

  if (decided === 0) {
    return { extractionStatus: "no_proposal", noteStatus: "draft" };
  }

  if (counts.committed > 0 && (counts.needs_review > 0 || counts.failed > 0)) {
    return { extractionStatus: "partially_committed", noteStatus: "preview" };
  }

  if (counts.committed > 0 && counts.needs_review === 0 && counts.failed === 0) {
    return { extractionStatus: "committed", noteStatus: "committed" };
  }

  if (counts.needs_review > 0) {
    return { extractionStatus: "needs_review", noteStatus: "preview" };
  }

  if (counts.failed > 0) {
    return { extractionStatus: "failed", noteStatus: "draft" };
  }

  return { extractionStatus: "no_proposal", noteStatus: "draft" };
}
