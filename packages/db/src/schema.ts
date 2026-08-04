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
 * Note lifecycle while NL extract → preview → graph commit.
 * Notes are free-form NL; track/transition links come from extraction, not FKs.
 */
export const noteStatusEnum = pgEnum("note_status", ["draft", "preview", "committed"]);

/**
 * Async extraction / agent pipeline state (DJ-34).
 * Independent of lifecycle `note_status`.
 */
export const noteExtractionStatusEnum = pgEnum("note_extraction_status", [
  "idle",
  "extracting",
  "no_proposal",
  "resolving",
  "needs_review",
  "committed",
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
 * Single-user MVP Postgres surface.
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
  status: noteStatusEnum("status").notNull().default("draft"),
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

/** One agent attempt for a note extraction version. */
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
  transitionCommits: many(noteTransitionCommits),
}));

export const noteTrackLinksRelations = relations(noteTrackLinks, ({ one }) => ({
  note: one(notes, {
    fields: [noteTrackLinks.noteId],
    references: [notes.id],
  }),
}));

export const noteAgentRunsRelations = relations(noteAgentRuns, ({ one }) => ({
  note: one(notes, {
    fields: [noteAgentRuns.noteId],
    references: [notes.id],
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
export type NoteStatus = (typeof noteStatusEnum.enumValues)[number];
export type NoteExtractionStatus = (typeof noteExtractionStatusEnum.enumValues)[number];
export type NoteTrackLink = typeof noteTrackLinks.$inferSelect;
export type NewNoteTrackLink = typeof noteTrackLinks.$inferInsert;
export type NoteAgentRun = typeof noteAgentRuns.$inferSelect;
export type NewNoteAgentRun = typeof noteAgentRuns.$inferInsert;
export type NoteAgentRunStatus = (typeof noteAgentRunStatusEnum.enumValues)[number];
export type NoteTransitionCommit = typeof noteTransitionCommits.$inferSelect;
export type NewNoteTransitionCommit = typeof noteTransitionCommits.$inferInsert;
export type NoteTransitionCommitStatus = (typeof noteTransitionCommitStatusEnum.enumValues)[number];
