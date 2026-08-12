import { relations, sql } from "drizzle-orm";
import {
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
  "dismissed",
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
 * Single-user MVP Postgres surface (product language: submission).
 *
 * Music domain (tracks, artists, vocab, transitions) lives in the tables below
 * (Neo4j removal in progress — DJ-80). Notes / proposals / audit stay here too.
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
 * Manual associations between a note and a library track.
 * `track_id` FK → tracks ON DELETE CASCADE (DJ-84).
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
    uniqueIndex("note_proposals_proposal_key_uidx").on(table.proposalKey),
    uniqueIndex("note_proposals_note_version_fingerprint_uidx").on(
      table.noteId,
      table.extractionVersion,
      table.sourceFingerprint,
    ),
    index("note_proposals_status_updated_idx").on(table.status, table.updatedAt),
    index("note_proposals_fingerprint_idx").on(table.sourceFingerprint),
  ],
);

/** Audit trail for manual proposal review actions (reject, edit, reopen, etc.). */
export const proposalReviewEvents = pgTable("proposal_review_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  proposalId: text("proposal_id")
    .notNull()
    .references(() => noteProposals.id, { onDelete: "cascade" }),
  action: proposalReviewActionEnum("action").notNull(),
  actor: text("actor"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Idempotent audit of transition commits keyed by proposalKey. */
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
  (table) => [uniqueIndex("note_transition_commits_proposal_key_uidx").on(table.proposalKey)],
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
    sourceNoteId: text("source_note_id").references(() => notes.id, { onDelete: "set null" }),
    sourceNoteVersion: integer("source_note_version"),
    sourceProposalId: text("source_proposal_id").references(() => noteProposals.id, {
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

export const notesRelations = relations(notes, ({ many }) => ({
  trackLinks: many(noteTrackLinks),
  agentRuns: many(noteAgentRuns),
  proposals: many(noteProposals),
  transitionCommits: many(noteTransitionCommits),
  sourcedTransitions: many(transitions),
}));

export const noteTrackLinksRelations = relations(noteTrackLinks, ({ one }) => ({
  note: one(notes, {
    fields: [noteTrackLinks.noteId],
    references: [notes.id],
  }),
  track: one(tracks, {
    fields: [noteTrackLinks.trackId],
    references: [tracks.id],
  }),
}));

export const noteAgentRunsRelations = relations(noteAgentRuns, ({ one, many }) => ({
  note: one(notes, {
    fields: [noteAgentRuns.noteId],
    references: [notes.id],
  }),
  proposals: many(noteProposals),
}));

export const noteProposalsRelations = relations(noteProposals, ({ one, many }) => ({
  note: one(notes, {
    fields: [noteProposals.noteId],
    references: [notes.id],
  }),
  agentRun: one(noteAgentRuns, {
    fields: [noteProposals.agentRunId],
    references: [noteAgentRuns.id],
  }),
  sourcedTransitions: many(transitions),
}));

export const noteTransitionCommitsRelations = relations(noteTransitionCommits, ({ one }) => ({
  note: one(notes, {
    fields: [noteTransitionCommits.noteId],
    references: [notes.id],
  }),
  fromTrack: one(tracks, {
    fields: [noteTransitionCommits.fromTrackId],
    references: [tracks.id],
    relationName: "transitionCommitFromTrack",
  }),
  toTrack: one(tracks, {
    fields: [noteTransitionCommits.toTrackId],
    references: [tracks.id],
    relationName: "transitionCommitToTrack",
  }),
}));

export const tracksRelations = relations(tracks, ({ many }) => ({
  externalIds: many(trackExternalIds),
  trackArtists: many(trackArtists),
  trackGenres: many(trackGenres),
  trackSubgenres: many(trackSubgenres),
  trackFolders: many(trackFolders),
  noteTrackLinks: many(noteTrackLinks),
  outboundTransitions: many(transitions, { relationName: "fromTrack" }),
  inboundTransitions: many(transitions, { relationName: "toTrack" }),
  transitionCommitsFrom: many(noteTransitionCommits, {
    relationName: "transitionCommitFromTrack",
  }),
  transitionCommitsTo: many(noteTransitionCommits, {
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

export const transitionsRelations = relations(transitions, ({ one }) => ({
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
  sourceNote: one(notes, {
    fields: [transitions.sourceNoteId],
    references: [notes.id],
  }),
  sourceProposal: one(noteProposals, {
    fields: [transitions.sourceProposalId],
    references: [noteProposals.id],
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
