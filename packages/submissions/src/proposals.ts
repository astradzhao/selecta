import { and, asc, desc, eq, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";

import { getDb } from "@selecta/db";
import { getExecutor } from "@selecta/db";
import { NotesError } from "./errors";
import {
  clampListLimit,
  clampListOffset,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
} from "@selecta/library";
import {
  noteProposals,
  notes,
  noteTransitionCommits,
  proposalReviewEvents,
  type Note,
  type NoteExtractionStatus,
  type NoteProposal,
  type NoteProposalStatus,
  type NoteTransitionCommit,
  type ProposalReviewAction,
} from "@selecta/db/schema";

export type ClaimProposalInput = {
  noteId: string;
  extractionVersion: number;
  agentRunId?: string | null;
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
      throw new NotesError("invalid_input", `Proposal key collision for "${input.proposalKey}".`);
    }
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
        agentRunId: input.agentRunId ?? null,
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

/** Batch-load proposals by id (Library transition enrichment). */
export async function getProposalsByIds(ids: string[]): Promise<Map<string, NoteProposal>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const byId = new Map<string, NoteProposal>();
  if (unique.length === 0) {
    return byId;
  }
  const rows = await getDb().select().from(noteProposals).where(inArray(noteProposals.id, unique));
  for (const row of rows) {
    byId.set(row.id, row);
  }
  return byId;
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
    .orderBy(asc(noteProposals.sourceStart), asc(noteProposals.createdAt));
}

export type ListProposalsInput = {
  noteId?: string;
  extractionVersion?: number;
  statuses?: NoteProposalStatus[];
  query?: string;
  limit?: number;
  offset?: number;
};

export type ListProposalsResult = {
  proposals: NoteProposal[];
  limit: number;
  offset: number;
  hasMore: boolean;
};

/** Cross-submission proposal query for review queues and note-scoped lists. */
export async function listProposals(input: ListProposalsInput = {}): Promise<ListProposalsResult> {
  const limit = clampListLimit(input.limit);
  const offset = clampListOffset(input.offset);
  const fetchLimit = limit + 1;

  const filters: SQL[] = [];
  const statuses = input.statuses?.filter(Boolean);
  const excludeSuperseded = !statuses?.includes("superseded");

  if (excludeSuperseded) {
    filters.push(ne(noteProposals.status, "superseded"));
  }
  if (statuses && statuses.length > 0) {
    filters.push(inArray(noteProposals.status, statuses));
  }
  if (input.noteId?.trim()) {
    filters.push(eq(noteProposals.noteId, input.noteId.trim()));
  }
  if (input.extractionVersion !== undefined && Number.isFinite(input.extractionVersion)) {
    filters.push(eq(noteProposals.extractionVersion, Math.floor(input.extractionVersion)));
  }
  const query = input.query?.trim();
  if (query) {
    filters.push(ilike(noteProposals.sourceText, `%${query}%`));
  }

  const where = filters.length > 0 ? and(...filters) : undefined;
  const versionScoped =
    input.noteId?.trim() &&
    input.extractionVersion !== undefined &&
    Number.isFinite(input.extractionVersion);

  const rows = await getDb()
    .select()
    .from(noteProposals)
    .where(where)
    .orderBy(
      ...(versionScoped
        ? [asc(noteProposals.sourceStart), asc(noteProposals.createdAt)]
        : [desc(noteProposals.updatedAt), desc(noteProposals.id)]),
    )
    .limit(fetchLimit)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    proposals: page,
    limit,
    offset,
    hasMore,
  };
}

export type ProposalDetailNote = Pick<
  Note,
  | "id"
  | "rawText"
  | "extractionVersion"
  | "extractionStatus"
  | "extractionError"
  | "extractionStartedAt"
  | "extractionFinishedAt"
  | "updatedAt"
>;

export type ProposalDetail = {
  proposal: NoteProposal;
  note: ProposalDetailNote;
  siblings: NoteProposal[];
  commit: NoteTransitionCommit | null;
};

/** Load one proposal with note context, siblings, and commit audit. */
export async function getProposalDetail(id: string): Promise<ProposalDetail | null> {
  const proposalId = id.trim();
  if (!proposalId) {
    return null;
  }

  const proposal = await getProposalById(proposalId);
  if (!proposal) {
    return null;
  }

  const [noteRow] = await getDb()
    .select()
    .from(notes)
    .where(eq(notes.id, proposal.noteId))
    .limit(1);
  if (!noteRow) {
    return null;
  }

  const siblings = await listProposalsForVersion(proposal.noteId, proposal.extractionVersion);
  const [commitRow] = await getDb()
    .select()
    .from(noteTransitionCommits)
    .where(eq(noteTransitionCommits.proposalKey, proposal.proposalKey))
    .limit(1);

  return {
    proposal,
    note: {
      id: noteRow.id,
      rawText: noteRow.rawText,
      extractionVersion: noteRow.extractionVersion,
      extractionStatus: noteRow.extractionStatus,
      extractionError: noteRow.extractionError,
      extractionStartedAt: noteRow.extractionStartedAt,
      extractionFinishedAt: noteRow.extractionFinishedAt,
      updatedAt: noteRow.updatedAt,
    },
    siblings,
    commit: commitRow ?? null,
  };
}

export type UpdateProposalInput = {
  status?: NoteProposalStatus;
  draft?: Record<string, unknown> | null;
  resolution?: Record<string, unknown> | null;
  policyResult?: Record<string, unknown> | null;
  model?: string | null;
  promptVersion?: string | null;
  usage?: Record<string, unknown> | null;
  attemptCount?: number;
  error?: string | null;
  agentRunId?: string | null;
  reviewState?: Record<string, unknown> | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
};

function buildProposalPatch(
  input: UpdateProposalInput,
): Partial<typeof noteProposals.$inferInsert> {
  return {
    status: input.status,
    draft: input.draft === undefined ? undefined : input.draft,
    resolution: input.resolution === undefined ? undefined : input.resolution,
    policyResult: input.policyResult === undefined ? undefined : input.policyResult,
    model: input.model === undefined ? undefined : input.model,
    promptVersion: input.promptVersion === undefined ? undefined : input.promptVersion,
    usage: input.usage === undefined ? undefined : input.usage,
    attemptCount: input.attemptCount,
    error: input.error === undefined ? undefined : (input.error?.slice(0, 2000) ?? null),
    agentRunId: input.agentRunId === undefined ? undefined : input.agentRunId,
    reviewState: input.reviewState === undefined ? undefined : input.reviewState,
    reviewedAt: input.reviewedAt === undefined ? undefined : input.reviewedAt,
    reviewedBy: input.reviewedBy === undefined ? undefined : input.reviewedBy,
    reviewNote:
      input.reviewNote === undefined ? undefined : (input.reviewNote?.slice(0, 2000) ?? null),
  };
}

export async function updateProposal(
  proposalId: string,
  input: UpdateProposalInput,
): Promise<NoteProposal | null> {
  const [row] = await getExecutor()
    .update(noteProposals)
    .set(buildProposalPatch(input))
    .where(eq(noteProposals.id, proposalId))
    .returning();
  return row ?? null;
}

export type UpdateProposalGuardedInput = {
  expectedUpdatedAt: Date;
  fromStatuses: NoteProposalStatus[];
  set: UpdateProposalInput;
};

/** Optimistic concurrency update — returns null when CAS fails. */
export async function updateProposalGuarded(
  id: string,
  input: UpdateProposalGuardedInput,
): Promise<NoteProposal | null> {
  if (input.fromStatuses.length === 0) {
    throw new NotesError("invalid_input", "fromStatuses must include at least one status.");
  }

  const [row] = await getExecutor()
    .update(noteProposals)
    .set(buildProposalPatch(input.set))
    .where(
      and(
        eq(noteProposals.id, id),
        eq(noteProposals.updatedAt, input.expectedUpdatedAt),
        inArray(noteProposals.status, input.fromStatuses),
      ),
    )
    .returning();
  return row ?? null;
}

export type InsertProposalReviewEventInput = {
  proposalId: string;
  action: ProposalReviewAction;
  actor?: string | null;
  payload?: Record<string, unknown> | null;
};

export async function insertProposalReviewEvent(
  input: InsertProposalReviewEventInput,
): Promise<typeof proposalReviewEvents.$inferSelect> {
  const [row] = await getExecutor()
    .insert(proposalReviewEvents)
    .values({
      proposalId: input.proposalId,
      action: input.action,
      actor: input.actor ?? null,
      payload: input.payload ?? null,
    })
    .returning();
  if (!row) {
    throw new NotesError("invalid_input", "Failed to insert proposal review event.");
  }
  return row;
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
  const rows = await getExecutor()
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
 * Derive submission-level extractionStatus from per-proposal counts.
 * Partial success is first-class: committed siblings are not blocked by review/failed ones.
 */
export function deriveSubmissionExtractionStatus(
  counts: ProposalStatusCounts,
): Extract<
  NoteExtractionStatus,
  | "no_proposal"
  | "needs_review"
  | "committed"
  | "partially_committed"
  | "commit_failed"
  | "failed"
  | "resolving"
  | "dismissed"
> {
  const inFlight = counts.queued + counts.parsing + counts.resolving + counts.ready;
  const decided = counts.committed + counts.needs_review + counts.failed + counts.rejected;

  if (inFlight > 0 && decided === 0) {
    return "resolving";
  }

  if (decided === 0) {
    return "no_proposal";
  }

  if (counts.committed > 0 && (counts.needs_review > 0 || counts.failed > 0)) {
    return "partially_committed";
  }

  if (counts.committed > 0 && counts.needs_review === 0 && counts.failed === 0) {
    return "committed";
  }

  if (counts.needs_review > 0) {
    return "needs_review";
  }

  if (counts.failed > 0) {
    return "failed";
  }

  if (
    counts.rejected > 0 &&
    counts.committed === 0 &&
    counts.needs_review === 0 &&
    counts.failed === 0 &&
    inFlight === 0
  ) {
    return "dismissed";
  }

  return "no_proposal";
}

/**
 * Recompute submission rollup after manual review actions.
 * Does not CAS on `extracting` — safe to call outside the workflow finalize step.
 */
export async function refreshSubmissionExtractionStatus(
  noteId: string,
  extractionVersion: number,
): Promise<Note | null> {
  const counts = await countProposalsForVersion(noteId, extractionVersion);
  const extractionStatus = deriveSubmissionExtractionStatus(counts);

  const [existing] = await getExecutor()
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.extractionVersion, extractionVersion)))
    .limit(1);
  if (!existing) {
    return null;
  }

  const extraction: Record<string, unknown> =
    existing.extraction &&
    typeof existing.extraction === "object" &&
    !Array.isArray(existing.extraction)
      ? { ...(existing.extraction as Record<string, unknown>) }
      : {};

  extraction.counts = counts;

  const applySummary = extraction.applySummary;
  if (applySummary && typeof applySummary === "object" && !Array.isArray(applySummary)) {
    extraction.applySummary = {
      ...(applySummary as Record<string, unknown>),
      committed: counts.committed,
      needsReview: counts.needs_review,
      failed: counts.failed + counts.rejected,
    };
  }

  const [row] = await getExecutor()
    .update(notes)
    .set({
      extractionStatus,
      extraction,
    })
    .where(and(eq(notes.id, noteId), eq(notes.extractionVersion, extractionVersion)))
    .returning();

  return row ?? null;
}

export { DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT, clampListLimit, clampListOffset };
