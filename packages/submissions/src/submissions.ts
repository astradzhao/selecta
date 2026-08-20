import { and, asc, desc, eq, gte, ilike, lte, max, sql, type SQL } from "drizzle-orm";

import { getDb } from "@selecta/db";
import { getExecutor } from "@selecta/db";
import { SubmissionsError } from "./errors";
import { MAX_SUBMISSION_RAW_BYTES, utf8ByteLength } from "./constants";
import {
  countProposalsForVersion,
  listProposalsForVersion,
  supersedeProposalsForSubmission,
} from "./proposals";
import {
  submissionAgentRuns,
  submissions,
  submissionTransitionCommits,
  type Submission,
  type SubmissionAgentRun,
  type SubmissionAgentRunStatus,
  type SubmissionExtractionStatus,
  type SubmissionProposal,
  type SubmissionTransitionCommit,
  type SubmissionTransitionCommitStatus,
} from "@selecta/db/schema";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
export { MAX_SUBMISSION_RAW_BYTES };

export type CreateSubmissionInput = {
  rawText: string;
};

export type UpdateSubmissionInput = {
  rawText: string;
};

export type ListSubmissionsInput = {
  /** Free-text search over raw submission body. */
  query?: string;
  /** Exact extractionStatus filter. */
  status?: SubmissionExtractionStatus;
  /** When true, only submissions whose current version has needs_review proposals or status. */
  needsReview?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
};

export type SubmissionProposalLink = {
  id: string;
  proposalKey: string;
  status: SubmissionProposal["status"];
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
};

export type SubmissionListItem = {
  submission: Submission;
  proposalCounts: {
    committed: number;
    needsReview: number;
    failed: number;
    total: number;
  };
  proposals: SubmissionProposalLink[];
};

export type ListSubmissionsResult = {
  submissions: SubmissionListItem[];
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type CompleteExtractionInput = {
  extraction: Record<string, unknown>;
  rawResponse: Record<string, unknown> | null;
  model: string;
  provider: string;
  promptVersion: string;
  extractionConfidence: number;
  extractionStatus: Extract<
    SubmissionExtractionStatus,
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
    throw new SubmissionsError("invalid_input", "rawText is required.");
  }
  const bytes = utf8ByteLength(trimmed);
  if (bytes > MAX_SUBMISSION_RAW_BYTES) {
    throw new SubmissionsError(
      "invalid_input",
      `Submission exceeds max raw size (${bytes} bytes > ${MAX_SUBMISSION_RAW_BYTES} bytes). Shorten the text and retry.`,
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
 * Create a submission from raw text and mark extraction as in-flight.
 * Extraction must run after the row is durable (caller schedules it).
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<Submission> {
  const rawText = requireRawText(input.rawText);
  const now = new Date();
  const [row] = await getDb()
    .insert(submissions)
    .values({
      rawText,
      extractionStatus: "extracting",
      extractionVersion: 1,
      extractionStartedAt: now,
      ...clearExtractionFields,
    })
    .returning();
  if (!row) {
    throw new SubmissionsError("invalid_input", "Failed to create submission.");
  }
  return row;
}

/** List submissions newest-first with optional Library filters (DJ-72). */
export async function listSubmissions(
  input: ListSubmissionsInput = {},
): Promise<ListSubmissionsResult> {
  const limit = clampLimit(input.limit);
  const offset =
    input.offset !== undefined && Number.isFinite(input.offset)
      ? Math.max(0, Math.floor(input.offset))
      : 0;
  const fetchLimit = limit + 1;

  const filters: SQL[] = [];
  const query = input.query?.trim();
  if (query) {
    filters.push(ilike(submissions.rawText, `%${query}%`));
  }
  if (input.status) {
    filters.push(eq(submissions.extractionStatus, input.status));
  }
  if (input.needsReview === true) {
    filters.push(
      sql`(
        ${submissions.extractionStatus} IN ('needs_review', 'partially_committed')
        OR EXISTS (
          SELECT 1 FROM submission_proposals p
          WHERE p.submission_id = ${submissions.id}
            AND p.extraction_version = ${submissions.extractionVersion}
            AND p.status = 'needs_review'
        )
      )`,
    );
  }
  if (input.createdAfter) {
    filters.push(gte(submissions.createdAt, input.createdAfter));
  }
  if (input.createdBefore) {
    filters.push(lte(submissions.createdAt, input.createdBefore));
  }

  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await getDb()
    .select()
    .from(submissions)
    .where(where)
    .orderBy(desc(submissions.createdAt), asc(submissions.id))
    .limit(fetchLimit)
    .offset(offset);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const submissionsWithMeta: SubmissionListItem[] = await Promise.all(
    page.map(async (submission) => {
      const counts = await countProposalsForVersion(submission.id, submission.extractionVersion);
      const proposals = await listProposalsForVersion(submission.id, submission.extractionVersion);
      return {
        submission,
        proposalCounts: {
          committed: counts.committed,
          needsReview: counts.needs_review,
          failed: counts.failed + counts.rejected,
          total: counts.total - counts.superseded,
        },
        proposals: proposals.map((proposal) => ({
          id: proposal.id,
          proposalKey: proposal.proposalKey,
          status: proposal.status,
          sourceStart: proposal.sourceStart,
          sourceEnd: proposal.sourceEnd,
          sourceText: proposal.sourceText,
        })),
      };
    }),
  );

  return {
    submissions: submissionsWithMeta,
    limit,
    offset,
    hasMore,
  };
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const submissionId = id.trim();
  if (!submissionId) {
    throw new SubmissionsError("invalid_input", "Submission id is required.");
  }
  const [row] = await getDb()
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);
  return row ?? null;
}

export type UpdateSubmissionResult = {
  submission: Submission;
  /** True when text changed and a new extraction version should run. */
  extractionQueued: boolean;
};

/**
 * Update raw submission text.
 * Text changes invalidate uncommitted extraction payloads, bump `extractionVersion`,
 * and mark the submission `extracting` for a new async run.
 */
export async function updateSubmission(
  id: string,
  input: UpdateSubmissionInput,
): Promise<UpdateSubmissionResult> {
  const submissionId = id.trim();
  if (!submissionId) {
    throw new SubmissionsError("invalid_input", "Submission id is required.");
  }
  const rawText = requireRawText(input.rawText);

  const existing = await getSubmissionById(submissionId);
  if (!existing) {
    throw new SubmissionsError("not_found", `Submission "${submissionId}" was not found.`);
  }

  if (existing.rawText === rawText) {
    return { submission: existing, extractionQueued: false };
  }

  const now = new Date();
  const [row] = await getDb()
    .update(submissions)
    .set({
      rawText,
      extractionStatus: "extracting",
      extractionVersion: existing.extractionVersion + 1,
      extractionStartedAt: now,
      ...clearExtractionFields,
    })
    .where(eq(submissions.id, submissionId))
    .returning();

  if (!row) {
    throw new SubmissionsError("not_found", `Submission "${submissionId}" was not found.`);
  }
  await supersedeProposalsForSubmission(submissionId, row.extractionVersion);
  return { submission: row, extractionQueued: true };
}

/**
 * Re-queue extraction for a clean retry (manual refresh / failed run).
 * Bumps `extractionVersion` and supersedes prior proposals so retries do not
 * accumulate overlapping spans from older prompt/agent runs.
 */
export async function requeueExtraction(id: string): Promise<Submission> {
  const existing = await getSubmissionById(id);
  if (!existing) {
    throw new SubmissionsError("not_found", `Submission "${id}" was not found.`);
  }

  const now = new Date();
  const nextVersion = existing.extractionVersion > 0 ? existing.extractionVersion + 1 : 1;
  const [row] = await getDb()
    .update(submissions)
    .set({
      extractionStatus: "extracting",
      extractionVersion: nextVersion,
      extractionStartedAt: now,
      ...clearExtractionFields,
    })
    .where(eq(submissions.id, existing.id))
    .returning();

  if (!row) {
    throw new SubmissionsError("not_found", `Submission "${id}" was not found.`);
  }
  await supersedeProposalsForSubmission(row.id, row.extractionVersion);
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
): Promise<Submission | null> {
  const now = new Date();
  const [row] = await getDb()
    .update(submissions)
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
        eq(submissions.id, id),
        eq(submissions.extractionVersion, version),
        eq(submissions.extractionStatus, "extracting"),
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
): Promise<Submission | null> {
  const now = new Date();
  const [row] = await getDb()
    .update(submissions)
    .set({
      extractionStatus: "failed",
      extractionError: errorMessage.slice(0, 2000),
      extractionFinishedAt: now,
    })
    .where(
      and(
        eq(submissions.id, id),
        eq(submissions.extractionVersion, version),
        eq(submissions.extractionStatus, "extracting"),
      ),
    )
    .returning();

  return row ?? null;
}

export type StartAgentRunInput = {
  submissionId: string;
  extractionVersion: number;
  agentName: string;
  model?: string | null;
  provider?: string | null;
  promptVersion?: string | null;
  promptHash?: string | null;
  workflowRunId?: string | null;
};

export async function startAgentRun(input: StartAgentRunInput): Promise<SubmissionAgentRun> {
  const attempts = await getDb()
    .select({ maxAttempt: max(submissionAgentRuns.attempt) })
    .from(submissionAgentRuns)
    .where(
      and(
        eq(submissionAgentRuns.submissionId, input.submissionId),
        eq(submissionAgentRuns.extractionVersion, input.extractionVersion),
      ),
    );
  const nextAttempt = (attempts[0]?.maxAttempt ?? 0) + 1;

  const [row] = await getDb()
    .insert(submissionAgentRuns)
    .values({
      submissionId: input.submissionId,
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
    throw new SubmissionsError("invalid_input", "Failed to start agent run.");
  }
  return row;
}

export async function attachWorkflowRunId(
  runId: string,
  workflowRunId: string,
): Promise<SubmissionAgentRun | null> {
  const [row] = await getDb()
    .update(submissionAgentRuns)
    .set({ workflowRunId })
    .where(eq(submissionAgentRuns.id, runId))
    .returning();
  return row ?? null;
}

export type FinishAgentRunInput = {
  status: Extract<SubmissionAgentRunStatus, "completed" | "failed" | "superseded">;
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
): Promise<SubmissionAgentRun | null> {
  const [row] = await getDb()
    .update(submissionAgentRuns)
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
    .where(and(eq(submissionAgentRuns.id, runId), eq(submissionAgentRuns.status, "running")))
    .returning();
  return row ?? null;
}

export async function listAgentRunsForSubmission(
  submissionId: string,
  limit = 10,
): Promise<SubmissionAgentRun[]> {
  return getDb()
    .select()
    .from(submissionAgentRuns)
    .where(eq(submissionAgentRuns.submissionId, submissionId))
    .orderBy(desc(submissionAgentRuns.createdAt))
    .limit(clampLimit(limit));
}

export type UpsertTransitionCommitInput = {
  submissionId: string;
  extractionVersion: number;
  proposalKey: string;
  status: SubmissionTransitionCommitStatus;
  fromTrackId?: string | null;
  toTrackId?: string | null;
  payload?: Record<string, unknown> | null;
  error?: string | null;
};

export async function upsertTransitionCommit(
  input: UpsertTransitionCommitInput,
): Promise<SubmissionTransitionCommit> {
  const db = getExecutor();
  const existing = await db
    .select()
    .from(submissionTransitionCommits)
    .where(eq(submissionTransitionCommits.proposalKey, input.proposalKey))
    .limit(1);

  if (existing[0]) {
    const [row] = await db
      .update(submissionTransitionCommits)
      .set({
        status: input.status,
        fromTrackId: input.fromTrackId ?? existing[0].fromTrackId,
        toTrackId: input.toTrackId ?? existing[0].toTrackId,
        payload: input.payload ?? existing[0].payload,
        error: input.error?.slice(0, 2000) ?? null,
        committedAt: input.status === "committed" ? new Date() : existing[0].committedAt,
      })
      .where(eq(submissionTransitionCommits.proposalKey, input.proposalKey))
      .returning();
    if (!row) {
      throw new SubmissionsError("invalid_input", "Failed to update transition commit.");
    }
    return row;
  }

  const [row] = await db
    .insert(submissionTransitionCommits)
    .values({
      submissionId: input.submissionId,
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
    throw new SubmissionsError("invalid_input", "Failed to create transition commit.");
  }
  return row;
}

export async function getTransitionCommitByKey(
  proposalKey: string,
): Promise<SubmissionTransitionCommit | null> {
  const [row] = await getDb()
    .select()
    .from(submissionTransitionCommits)
    .where(eq(submissionTransitionCommits.proposalKey, proposalKey))
    .limit(1);
  return row ?? null;
}
