import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Async extraction / agent pipeline state (DJ-34 / DJ-66).
 * Derived rollup from per-proposal statuses — not independent business logic.
 * `partially_committed` = some proposals committed while siblings need review/failed.
 */
export const noteExtractionStatusEnum = pgEnum("note_extraction_status", [
  "idle",
  "extracting",
  "no_proposal",
  "resolving",
  "needs_review",
  "committed",
  "partially_committed",
  "commit_failed",
  "failed",
]);

export const noteAgentRunStatusEnum = pgEnum("note_agent_run_status", [
  "running",
  "completed",
  "failed",
  "superseded",
]);

export const noteTransitionCommitStatusEnum = pgEnum("note_transition_commit_status", [
  "pending",
  "committed",
  "commit_failed",
  "rejected",
]);

/**
 * Per-transition proposal lifecycle (DJ-66).
 * Source of truth for partial writes: clear proposals commit independently of siblings.
 */
export const noteProposalStatusEnum = pgEnum("note_proposal_status", [
  "queued",
  "parsing",
  "resolving",
  "ready",
  "needs_review",
  "committed",
  "failed",
  "rejected",
  "superseded",
]);

/**
 * Single-user MVP Postgres surface (product language: submission).
 *
 * Tracks / artists / genres / transitions live in Neo4j (one shared graph = the library).
 * Users, libraries, membership, and live sessions are deferred until multi-tenant / Live Mode needs them.
 */
export const notes = pgTable("notes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  rawText: text("raw_text").notNull(),
  /** Structured NL extraction / agent plan preview (filled by M3). */
  extraction: jsonb("extraction").$type<Record<string, unknown>>(),
  extractionStatus: noteExtractionStatusEnum("extraction_status").notNull().default("idle"),
  /** Bumped when text changes; CAS key for idempotent extraction callbacks. */
  extractionVersion: integer("extraction_version").notNull().default(0),
  extractionError: text("extraction_error"),
  extractionConfidence: real("extraction_confidence"),
  extractionStartedAt: timestamp("extraction_started_at", { withTimezone: true }),
  extractionFinishedAt: timestamp("extraction_finished_at", { withTimezone: true }),
  /** Provider prefix from the model id (e.g. `openai` from `openai/gpt-4.1-mini`). */
  provider: text("provider"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  rawResponse: jsonb("raw_response").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Manual associations between a Postgres note and Neo4j Track ids.
 * No cross-database FK — `trackId` is an opaque Neo4j Track.id string.
 * Parsed extraction mentions must not write here without explicit user confirmation.
 */
export const noteTrackLinks = pgTable(
  "note_track_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    /** Neo4j `Track.id` (string). Not a Postgres FK. */
    trackId: text("track_id").notNull(),
    /** Optional free-form role (e.g. from / to / mentioned). */
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("note_track_links_note_id_track_id_uidx").on(table.noteId, table.trackId),
  ],
);

/** One agent / workflow attempt for a note extraction version. */
export const noteAgentRuns = pgTable(
  "note_agent_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    extractionVersion: integer("extraction_version").notNull(),
    attempt: integer("attempt").notNull().default(1),
    agentName: text("agent_name").notNull(),
    status: noteAgentRunStatusEnum("status").notNull().default("running"),
    /** Durable Workflow DevKit run id when launched via `start()`. */
    workflowRunId: text("workflow_run_id"),
    model: text("model"),
    provider: text("provider"),
    promptVersion: text("prompt_version"),
    promptHash: text("prompt_hash"),
    stepCount: integer("step_count").notNull().default(0),
    toolCallCount: integer("tool_call_count").notNull().default(0),
    usage: jsonb("usage").$type<Record<string, unknown>>(),
    toolSummary: jsonb("tool_summary").$type<Record<string, unknown>>(),
    plan: jsonb("plan").$type<Record<string, unknown>>(),
    policyResult: jsonb("policy_result").$type<Record<string, unknown>>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("note_agent_runs_note_version_attempt_uidx").on(
      table.noteId,
      table.extractionVersion,
      table.attempt,
    ),
  ],
);

/**
 * First-class per-transition proposal (DJ-66).
 * Idempotency key = submissionId:version:span:sourceFingerprint (`proposal_key`).
 */
export const noteProposals = pgTable(
  "note_proposals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    extractionVersion: integer("extraction_version").notNull(),
    agentRunId: text("agent_run_id").references(() => noteAgentRuns.id, { onDelete: "set null" }),
    sourceStart: integer("source_start").notNull(),
    sourceEnd: integer("source_end").notNull(),
    sourceText: text("source_text").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    /** Stable idempotency key: `{noteId}:{version}:span:{fingerprint}`. */
    proposalKey: text("proposal_key").notNull(),
    status: noteProposalStatusEnum("status").notNull().default("queued"),
    draft: jsonb("draft").$type<Record<string, unknown>>(),
    resolution: jsonb("resolution").$type<Record<string, unknown>>(),
    /** Policy outcome + nested reviewReasons. */
    policyResult: jsonb("policy_result").$type<Record<string, unknown>>(),
    model: text("model"),
    promptVersion: text("prompt_version"),
    usage: jsonb("usage").$type<Record<string, unknown>>(),
    /** Child parse retry counter (source of truth for retry bounds). */
    attemptCount: integer("attempt_count").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("note_proposals_proposal_key_uidx").on(table.proposalKey),
    uniqueIndex("note_proposals_note_version_fingerprint_uidx").on(
      table.noteId,
      table.extractionVersion,
      table.sourceFingerprint,
    ),
  ],
);

/** Idempotent audit of graph transition commits keyed by proposalKey. */
export const noteTransitionCommits = pgTable(
  "note_transition_commits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    extractionVersion: integer("extraction_version").notNull(),
    proposalKey: text("proposal_key").notNull(),
    status: noteTransitionCommitStatusEnum("status").notNull().default("pending"),
    fromTrackId: text("from_track_id"),
    toTrackId: text("to_track_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    error: text("error"),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("note_transition_commits_proposal_key_uidx").on(table.proposalKey)],
);

export const notesRelations = relations(notes, ({ many }) => ({
  trackLinks: many(noteTrackLinks),
  agentRuns: many(noteAgentRuns),
  proposals: many(noteProposals),
  transitionCommits: many(noteTransitionCommits),
}));

export const noteTrackLinksRelations = relations(noteTrackLinks, ({ one }) => ({
  note: one(notes, {
    fields: [noteTrackLinks.noteId],
    references: [notes.id],
  }),
}));

export const noteAgentRunsRelations = relations(noteAgentRuns, ({ one, many }) => ({
  note: one(notes, {
    fields: [noteAgentRuns.noteId],
    references: [notes.id],
  }),
  proposals: many(noteProposals),
}));

export const noteProposalsRelations = relations(noteProposals, ({ one }) => ({
  note: one(notes, {
    fields: [noteProposals.noteId],
    references: [notes.id],
  }),
  agentRun: one(noteAgentRuns, {
    fields: [noteProposals.agentRunId],
    references: [noteAgentRuns.id],
  }),
}));

export const noteTransitionCommitsRelations = relations(noteTransitionCommits, ({ one }) => ({
  note: one(notes, {
    fields: [noteTransitionCommits.noteId],
    references: [notes.id],
  }),
}));

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type NoteExtractionStatus = (typeof noteExtractionStatusEnum.enumValues)[number];
export type NoteTrackLink = typeof noteTrackLinks.$inferSelect;
export type NewNoteTrackLink = typeof noteTrackLinks.$inferInsert;
export type NoteAgentRun = typeof noteAgentRuns.$inferSelect;
export type NewNoteAgentRun = typeof noteAgentRuns.$inferInsert;
export type NoteAgentRunStatus = (typeof noteAgentRunStatusEnum.enumValues)[number];
export type NoteProposal = typeof noteProposals.$inferSelect;
export type NewNoteProposal = typeof noteProposals.$inferInsert;
export type NoteProposalStatus = (typeof noteProposalStatusEnum.enumValues)[number];
export type NoteTransitionCommit = typeof noteTransitionCommits.$inferSelect;
export type NewNoteTransitionCommit = typeof noteTransitionCommits.$inferInsert;
export type NoteTransitionCommitStatus = (typeof noteTransitionCommitStatusEnum.enumValues)[number];
