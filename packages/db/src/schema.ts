import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
export const submissionExtractionStatusEnum = pgEnum("submission_extraction_status", [
  "idle",
  "extracting",
  "no_proposal",
  "resolving",
  "needs_review",
  "committed",
  "partially_committed",
  "commit_failed",
  "failed",
  "dismissed",
]);

export const submissionAgentRunStatusEnum = pgEnum("submission_agent_run_status", [
  "running",
  "completed",
  "failed",
  "superseded",
]);

export const submissionTransitionCommitStatusEnum = pgEnum("submission_transition_commit_status", [
  "pending",
  "committed",
  "commit_failed",
  "rejected",
]);

/**
 * Per-transition proposal lifecycle (DJ-66).
 * Source of truth for partial writes: clear proposals commit independently of siblings.
 */
export const submissionProposalStatusEnum = pgEnum("submission_proposal_status", [
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

export const proposalReviewActionEnum = pgEnum("proposal_review_action", [
  "approve",
  "reject",
  "edit",
  "resolve",
  "reparse",
  "reopen",
]);

/**
 * Optional DJ organization kind on `folders` (product copy only).
 * `section` was dropped — only folders and playlists are product concepts.
 */
export const folderKindEnum = pgEnum("folder_kind", ["folder", "playlist"]);

/**
 * Sequence kind on `blocks` (DJ-111). Filter label only — blocks and sets share
 * one rule set. `set` is a night; `block` is a reusable run offered as a connector.
 */
export const blockKindEnum = pgEnum("block_kind", ["block", "set"]);

/**
 * Single-user MVP Postgres surface (product language: submission).
 *
 * Music domain (tracks, artists, vocab, transitions) lives in the tables below
 * Submissions, proposals, and audit stay here too.
 * Users, libraries, membership, and live sessions are deferred until multi-tenant / Live Mode needs them.
 */
export const submissions = pgTable("submissions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  rawText: text("raw_text").notNull(),
  /** Structured NL extraction / agent plan preview (filled by M3). */
  extraction: jsonb("extraction").$type<Record<string, unknown>>(),
  extractionStatus: submissionExtractionStatusEnum("extraction_status").notNull().default("idle"),
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
 * Manual associations between a submission and a library track.
 * `track_id` FK → tracks ON DELETE CASCADE (DJ-84).
 */
export const submissionTrackLinks = pgTable(
  "submission_track_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    /** Optional free-form role (e.g. from / to / mentioned). */
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("submission_track_links_submission_id_track_id_uidx").on(
      table.submissionId,
      table.trackId,
    ),
  ],
);

/** One agent / workflow attempt for a submission extraction version. */
export const submissionAgentRuns = pgTable(
  "submission_agent_runs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    extractionVersion: integer("extraction_version").notNull(),
    attempt: integer("attempt").notNull().default(1),
    agentName: text("agent_name").notNull(),
    status: submissionAgentRunStatusEnum("status").notNull().default("running"),
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
    uniqueIndex("submission_agent_runs_submission_version_attempt_uidx").on(
      table.submissionId,
      table.extractionVersion,
      table.attempt,
    ),
  ],
);

/**
 * First-class per-transition proposal (DJ-66).
 * Idempotency key = submissionId:version:span:sourceFingerprint (`proposal_key`).
 */
export const submissionProposals = pgTable(
  "submission_proposals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    extractionVersion: integer("extraction_version").notNull(),
    agentRunId: text("agent_run_id").references(() => submissionAgentRuns.id, {
      onDelete: "set null",
    }),
    sourceStart: integer("source_start").notNull(),
    sourceEnd: integer("source_end").notNull(),
    sourceText: text("source_text").notNull(),
    sourceFingerprint: text("source_fingerprint").notNull(),
    /** Stable idempotency key: `{submissionId}:{version}:span:{fingerprint}`. */
    proposalKey: text("proposal_key").notNull(),
    status: submissionProposalStatusEnum("status").notNull().default("queued"),
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
    /** Reviewer's in-progress endpoint/field selections (park without committing). */
    reviewState: jsonb("review_state").$type<Record<string, unknown>>(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("submission_proposals_proposal_key_uidx").on(table.proposalKey),
    uniqueIndex("submission_proposals_submission_version_fingerprint_uidx").on(
      table.submissionId,
      table.extractionVersion,
      table.sourceFingerprint,
    ),
    index("submission_proposals_status_updated_idx").on(table.status, table.updatedAt),
    index("submission_proposals_fingerprint_idx").on(table.sourceFingerprint),
  ],
);

/** Audit trail for manual proposal review actions (reject, edit, reopen, etc.). */
export const proposalReviewEvents = pgTable("proposal_review_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => submissionProposals.id, { onDelete: "cascade" }),
  action: proposalReviewActionEnum("action").notNull(),
  actor: text("actor"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Idempotent audit of transition commits keyed by proposalKey. */
export const submissionTransitionCommits = pgTable(
  "submission_transition_commits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    extractionVersion: integer("extraction_version").notNull(),
    proposalKey: text("proposal_key").notNull(),
    status: submissionTransitionCommitStatusEnum("status").notNull().default("pending"),
    fromTrackId: text("from_track_id").references(() => tracks.id, { onDelete: "set null" }),
    toTrackId: text("to_track_id").references(() => tracks.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    error: text("error"),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("submission_transition_commits_proposal_key_uidx").on(table.proposalKey)],
);

/** Library track (music domain; Neo4j Track node equivalent). */
export const tracks = pgTable(
  "tracks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    bpm: real("bpm"),
    musicalKey: text("musical_key"),
    durationSec: real("duration_sec"),
    energy: real("energy"),
    artworkUrl: text("artwork_url"),
    /** ISO-ish string (not a date column) — preserves Neo4j / list-filter semantics. */
    releaseDate: text("release_date"),
    libraryId: text("library_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tracks_title_idx").on(table.title),
    index("tracks_created_at_idx").on(table.createdAt),
    index("tracks_updated_at_idx").on(table.updatedAt),
  ],
);

/** Provider external ids for a track (`spotify:<id>` → row); one library track per external id. */
export const trackExternalIds = pgTable(
  "track_external_ids",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    /** Lowercased provider key; must not contain `:`. */
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.trackId, table.provider, table.providerId] }),
    uniqueIndex("track_external_ids_provider_provider_id_uidx").on(
      table.provider,
      table.providerId,
    ),
  ],
);

export const artists = pgTable(
  "artists",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("artists_name_normalized_uidx").on(table.nameNormalized)],
);

export const genres = pgTable(
  "genres",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("genres_name_normalized_uidx").on(table.nameNormalized)],
);

export const subgenres = pgTable(
  "subgenres",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("subgenres_name_normalized_uidx").on(table.nameNormalized)],
);

/** DJ-owned folder or playlist (no `section` kind). */
export const folders = pgTable(
  "folders",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    kind: folderKindEnum("kind"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("folders_name_normalized_uidx").on(table.nameNormalized)],
);

export const trackArtists = pgTable(
  "track_artists",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    artistId: text("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.trackId, table.artistId] })],
);

export const trackGenres = pgTable(
  "track_genres",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    genreId: text("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.trackId, table.genreId] })],
);

export const trackSubgenres = pgTable(
  "track_subgenres",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    subgenreId: text("subgenre_id")
      .notNull()
      .references(() => subgenres.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.trackId, table.subgenreId] })],
);

export const trackFolders = pgTable(
  "track_folders",
  {
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.trackId, table.folderId] })],
);

/**
 * Committed track→track transition (Neo4j TRANSITION edge equivalent).
 * Parallel A→B rows are valid — no uniqueness on (from_track_id, to_track_id).
 * `proposal_key` NULL = manual; non-NULL = AI commit (partial unique for idempotency).
 */
export const transitions = pgTable(
  "transitions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    fromTrackId: text("from_track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    toTrackId: text("to_track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    proposalKey: text("proposal_key"),
    sourceSubmissionId: text("source_submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    sourceSubmissionVersion: integer("source_submission_version"),
    sourceProposalId: text("source_proposal_id").references(() => submissionProposals.id, {
      onDelete: "set null",
    }),
    confidence: real("confidence"),
    fromBar: integer("from_bar"),
    toBar: integer("to_bar"),
    barsOverlap: integer("bars_overlap"),
    technique: text("technique"),
    intent: text("intent"),
    quality: text("quality"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("transitions_proposal_key_uidx")
      .on(table.proposalKey)
      .where(sql`${table.proposalKey} IS NOT NULL`),
    index("transitions_from_track_id_idx").on(table.fromTrackId),
    index("transitions_to_track_id_idx").on(table.toTrackId),
  ],
);

export const submissionsRelations = relations(submissions, ({ many }) => ({
  trackLinks: many(submissionTrackLinks),
  agentRuns: many(submissionAgentRuns),
  proposals: many(submissionProposals),
  transitionCommits: many(submissionTransitionCommits),
  sourcedTransitions: many(transitions),
}));

export const submissionTrackLinksRelations = relations(submissionTrackLinks, ({ one }) => ({
  submission: one(submissions, {
    fields: [submissionTrackLinks.submissionId],
    references: [submissions.id],
  }),
  track: one(tracks, {
    fields: [submissionTrackLinks.trackId],
    references: [tracks.id],
  }),
}));

export const submissionAgentRunsRelations = relations(submissionAgentRuns, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [submissionAgentRuns.submissionId],
    references: [submissions.id],
  }),
  proposals: many(submissionProposals),
}));

export const submissionProposalsRelations = relations(submissionProposals, ({ one, many }) => ({
  submission: one(submissions, {
    fields: [submissionProposals.submissionId],
    references: [submissions.id],
  }),
  agentRun: one(submissionAgentRuns, {
    fields: [submissionProposals.agentRunId],
    references: [submissionAgentRuns.id],
  }),
  sourcedTransitions: many(transitions),
}));

export const submissionTransitionCommitsRelations = relations(
  submissionTransitionCommits,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionTransitionCommits.submissionId],
      references: [submissions.id],
    }),
    fromTrack: one(tracks, {
      fields: [submissionTransitionCommits.fromTrackId],
      references: [tracks.id],
      relationName: "transitionCommitFromTrack",
    }),
    toTrack: one(tracks, {
      fields: [submissionTransitionCommits.toTrackId],
      references: [tracks.id],
      relationName: "transitionCommitToTrack",
    }),
  }),
);

export const tracksRelations = relations(tracks, ({ many }) => ({
  externalIds: many(trackExternalIds),
  trackArtists: many(trackArtists),
  trackGenres: many(trackGenres),
  trackSubgenres: many(trackSubgenres),
  trackFolders: many(trackFolders),
  submissionTrackLinks: many(submissionTrackLinks),
  outboundTransitions: many(transitions, { relationName: "fromTrack" }),
  inboundTransitions: many(transitions, { relationName: "toTrack" }),
  sequenceStarts: many(blocks, { relationName: "blockStartTrack" }),
  sequenceEnds: many(blocks, { relationName: "blockEndTrack" }),
  sequenceSteps: many(blockSteps),
  transitionCommitsFrom: many(submissionTransitionCommits, {
    relationName: "transitionCommitFromTrack",
  }),
  transitionCommitsTo: many(submissionTransitionCommits, {
    relationName: "transitionCommitToTrack",
  }),
}));

export const trackExternalIdsRelations = relations(trackExternalIds, ({ one }) => ({
  track: one(tracks, {
    fields: [trackExternalIds.trackId],
    references: [tracks.id],
  }),
}));

export const artistsRelations = relations(artists, ({ many }) => ({
  trackArtists: many(trackArtists),
}));

export const genresRelations = relations(genres, ({ many }) => ({
  trackGenres: many(trackGenres),
}));

export const subgenresRelations = relations(subgenres, ({ many }) => ({
  trackSubgenres: many(trackSubgenres),
}));

export const foldersRelations = relations(folders, ({ many }) => ({
  trackFolders: many(trackFolders),
}));

export const trackArtistsRelations = relations(trackArtists, ({ one }) => ({
  track: one(tracks, {
    fields: [trackArtists.trackId],
    references: [tracks.id],
  }),
  artist: one(artists, {
    fields: [trackArtists.artistId],
    references: [artists.id],
  }),
}));

export const trackGenresRelations = relations(trackGenres, ({ one }) => ({
  track: one(tracks, {
    fields: [trackGenres.trackId],
    references: [tracks.id],
  }),
  genre: one(genres, {
    fields: [trackGenres.genreId],
    references: [genres.id],
  }),
}));

export const trackSubgenresRelations = relations(trackSubgenres, ({ one }) => ({
  track: one(tracks, {
    fields: [trackSubgenres.trackId],
    references: [tracks.id],
  }),
  subgenre: one(subgenres, {
    fields: [trackSubgenres.subgenreId],
    references: [subgenres.id],
  }),
}));

export const trackFoldersRelations = relations(trackFolders, ({ one }) => ({
  track: one(tracks, {
    fields: [trackFolders.trackId],
    references: [tracks.id],
  }),
  folder: one(folders, {
    fields: [trackFolders.folderId],
    references: [folders.id],
  }),
}));

/**
 * Ordered, composable path through the transition graph (DJ-111 / SET-1).
 * `kind` is a filter label (`block` | `set`) with no behavioral rules of its own.
 * `startTrackId` / `endTrackId` / `isComplete` are derived caches — never authored.
 */
export const blocks = pgTable(
  "blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    kind: blockKindEnum("kind").notNull().default("block"),
    title: text("title").notNull(),
    description: text("description"),
    startTrackId: text("start_track_id").references(() => tracks.id, { onDelete: "set null" }),
    endTrackId: text("end_track_id").references(() => tracks.id, { onDelete: "set null" }),
    isComplete: boolean("is_complete").notNull().default(false),
    libraryId: text("library_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("blocks_endpoints_idx").on(t.startTrackId, t.endTrackId)],
);

/**
 * One track in a sequence. Connectors annotate the join *into* this step.
 * `position` is an ordering hint, not identity — not unique (DJ-111 §5.4).
 */
export const blockSteps = pgTable(
  "block_steps",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    blockId: text("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    trackId: text("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    inTransitionId: text("in_transition_id").references(() => transitions.id, {
      onDelete: "set null",
    }),
    inBlockId: text("in_block_id").references((): AnyPgColumn => blocks.id, {
      onDelete: "set null",
    }),
    isSeam: boolean("is_seam").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "block_steps_single_connector",
      sql`NOT (${t.inTransitionId} IS NOT NULL AND ${t.inBlockId} IS NOT NULL)`,
    ),
    index("block_steps_block_position_idx").on(t.blockId, t.position),
    index("block_steps_track_idx").on(t.trackId),
    index("block_steps_in_transition_idx").on(t.inTransitionId),
    index("block_steps_in_block_idx").on(t.inBlockId),
  ],
);

/**
 * Substitutable span: one connector replaces `fromStepId..toStepId` on the primary line.
 * Spans are anchored to step IDs, never positions (DJ-111 §5.3).
 */
export const blockAlternates = pgTable(
  "block_alternates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    blockId: text("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    label: text("label"),
    fromStepId: text("from_step_id")
      .notNull()
      .references(() => blockSteps.id, { onDelete: "cascade" }),
    toStepId: text("to_step_id")
      .notNull()
      .references(() => blockSteps.id, { onDelete: "cascade" }),
    altTransitionId: text("alt_transition_id").references(() => transitions.id, {
      onDelete: "cascade",
    }),
    altBlockId: text("alt_block_id").references(() => blocks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "block_alternates_single_connector",
      sql`(${t.altTransitionId} IS NULL) <> (${t.altBlockId} IS NULL)`,
    ),
    index("block_alternates_block_idx").on(t.blockId),
  ],
);

/** Named selection of alternates — not a copy of the sequence. */
export const blockVersions = pgTable(
  "block_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    blockId: text("block_id")
      .notNull()
      .references(() => blocks.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("block_versions_block_idx").on(t.blockId)],
);

export const blockVersionChoices = pgTable(
  "block_version_choices",
  {
    versionId: text("version_id")
      .notNull()
      .references(() => blockVersions.id, { onDelete: "cascade" }),
    alternateId: text("alternate_id")
      .notNull()
      .references(() => blockAlternates.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.versionId, t.alternateId] }),
    index("block_version_choices_alternate_idx").on(t.alternateId),
  ],
);

export const transitionsRelations = relations(transitions, ({ one, many }) => ({
  fromTrack: one(tracks, {
    fields: [transitions.fromTrackId],
    references: [tracks.id],
    relationName: "fromTrack",
  }),
  toTrack: one(tracks, {
    fields: [transitions.toTrackId],
    references: [tracks.id],
    relationName: "toTrack",
  }),
  sourceSubmission: one(submissions, {
    fields: [transitions.sourceSubmissionId],
    references: [submissions.id],
  }),
  sourceProposal: one(submissionProposals, {
    fields: [transitions.sourceProposalId],
    references: [submissionProposals.id],
  }),
  inboundSequenceSteps: many(blockSteps),
  alternateUses: many(blockAlternates),
}));

export const blocksRelations = relations(blocks, ({ one, many }) => ({
  startTrack: one(tracks, {
    fields: [blocks.startTrackId],
    references: [tracks.id],
    relationName: "blockStartTrack",
  }),
  endTrack: one(tracks, {
    fields: [blocks.endTrackId],
    references: [tracks.id],
    relationName: "blockEndTrack",
  }),
  steps: many(blockSteps),
  alternates: many(blockAlternates),
  versions: many(blockVersions),
  usedAsStepConnector: many(blockSteps, { relationName: "stepInBlock" }),
  usedAsAlternateConnector: many(blockAlternates, { relationName: "alternateInBlock" }),
}));

export const blockStepsRelations = relations(blockSteps, ({ one, many }) => ({
  sequence: one(blocks, {
    fields: [blockSteps.blockId],
    references: [blocks.id],
  }),
  track: one(tracks, {
    fields: [blockSteps.trackId],
    references: [tracks.id],
  }),
  inTransition: one(transitions, {
    fields: [blockSteps.inTransitionId],
    references: [transitions.id],
  }),
  inBlock: one(blocks, {
    fields: [blockSteps.inBlockId],
    references: [blocks.id],
    relationName: "stepInBlock",
  }),
  alternatesFrom: many(blockAlternates, { relationName: "alternateFromStep" }),
  alternatesTo: many(blockAlternates, { relationName: "alternateToStep" }),
}));

export const blockAlternatesRelations = relations(blockAlternates, ({ one, many }) => ({
  sequence: one(blocks, {
    fields: [blockAlternates.blockId],
    references: [blocks.id],
  }),
  fromStep: one(blockSteps, {
    fields: [blockAlternates.fromStepId],
    references: [blockSteps.id],
    relationName: "alternateFromStep",
  }),
  toStep: one(blockSteps, {
    fields: [blockAlternates.toStepId],
    references: [blockSteps.id],
    relationName: "alternateToStep",
  }),
  altTransition: one(transitions, {
    fields: [blockAlternates.altTransitionId],
    references: [transitions.id],
  }),
  altBlock: one(blocks, {
    fields: [blockAlternates.altBlockId],
    references: [blocks.id],
    relationName: "alternateInBlock",
  }),
  versionChoices: many(blockVersionChoices),
}));

export const blockVersionsRelations = relations(blockVersions, ({ one, many }) => ({
  sequence: one(blocks, {
    fields: [blockVersions.blockId],
    references: [blocks.id],
  }),
  choices: many(blockVersionChoices),
}));

export const blockVersionChoicesRelations = relations(blockVersionChoices, ({ one }) => ({
  version: one(blockVersions, {
    fields: [blockVersionChoices.versionId],
    references: [blockVersions.id],
  }),
  alternate: one(blockAlternates, {
    fields: [blockVersionChoices.alternateId],
    references: [blockAlternates.id],
  }),
}));

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type SubmissionExtractionStatus = (typeof submissionExtractionStatusEnum.enumValues)[number];
export type SubmissionTrackLink = typeof submissionTrackLinks.$inferSelect;
export type NewSubmissionTrackLink = typeof submissionTrackLinks.$inferInsert;
export type SubmissionAgentRun = typeof submissionAgentRuns.$inferSelect;
export type NewSubmissionAgentRun = typeof submissionAgentRuns.$inferInsert;
export type SubmissionAgentRunStatus = (typeof submissionAgentRunStatusEnum.enumValues)[number];
export type SubmissionProposal = typeof submissionProposals.$inferSelect;
export type NewSubmissionProposal = typeof submissionProposals.$inferInsert;
export type SubmissionProposalStatus = (typeof submissionProposalStatusEnum.enumValues)[number];
export type SubmissionTransitionCommit = typeof submissionTransitionCommits.$inferSelect;
export type NewSubmissionTransitionCommit = typeof submissionTransitionCommits.$inferInsert;
export type SubmissionTransitionCommitStatus =
  (typeof submissionTransitionCommitStatusEnum.enumValues)[number];
export type ProposalReviewEvent = typeof proposalReviewEvents.$inferSelect;
export type NewProposalReviewEvent = typeof proposalReviewEvents.$inferInsert;
export type ProposalReviewAction = (typeof proposalReviewActionEnum.enumValues)[number];

export type FolderKind = (typeof folderKindEnum.enumValues)[number];
export type Track = typeof tracks.$inferSelect;
export type NewTrack = typeof tracks.$inferInsert;
export type TrackExternalId = typeof trackExternalIds.$inferSelect;
export type NewTrackExternalId = typeof trackExternalIds.$inferInsert;
export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type NewGenre = typeof genres.$inferInsert;
export type Subgenre = typeof subgenres.$inferSelect;
export type NewSubgenre = typeof subgenres.$inferInsert;
export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type TrackArtist = typeof trackArtists.$inferSelect;
export type NewTrackArtist = typeof trackArtists.$inferInsert;
export type TrackGenre = typeof trackGenres.$inferSelect;
export type NewTrackGenre = typeof trackGenres.$inferInsert;
export type TrackSubgenre = typeof trackSubgenres.$inferSelect;
export type NewTrackSubgenre = typeof trackSubgenres.$inferInsert;
export type TrackFolder = typeof trackFolders.$inferSelect;
export type NewTrackFolder = typeof trackFolders.$inferInsert;
/** Raw `transitions` table row (distinct from hydrated `TransitionRecord` in PG-3). */
export type TransitionRow = typeof transitions.$inferSelect;
export type NewTransitionRow = typeof transitions.$inferInsert;
export type BlockKind = (typeof blockKindEnum.enumValues)[number];
export type BlockRow = typeof blocks.$inferSelect;
export type NewBlockRow = typeof blocks.$inferInsert;
export type BlockStepRow = typeof blockSteps.$inferSelect;
export type NewBlockStepRow = typeof blockSteps.$inferInsert;
export type BlockAlternateRow = typeof blockAlternates.$inferSelect;
export type NewBlockAlternateRow = typeof blockAlternates.$inferInsert;
export type BlockVersionRow = typeof blockVersions.$inferSelect;
export type NewBlockVersionRow = typeof blockVersions.$inferInsert;
export type BlockVersionChoiceRow = typeof blockVersionChoices.$inferSelect;
export type NewBlockVersionChoiceRow = typeof blockVersionChoices.$inferInsert;
