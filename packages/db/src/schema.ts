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
 * Async extraction pipeline state (DJ-34). Independent of lifecycle `note_status`.
 * `resolving` means proposals are stored and awaiting mention resolution (DJ-35).
 */
export const noteExtractionStatusEnum = pgEnum("note_extraction_status", [
  "idle",
  "extracting",
  "no_proposal",
  "resolving",
  "failed",
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
  /** Structured NL extraction preview / commit payload (filled by M3). */
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

export const notesRelations = relations(notes, ({ many }) => ({
  trackLinks: many(noteTrackLinks),
}));

export const noteTrackLinksRelations = relations(noteTrackLinks, ({ one }) => ({
  note: one(notes, {
    fields: [noteTrackLinks.noteId],
    references: [notes.id],
  }),
}));

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type NoteStatus = (typeof noteStatusEnum.enumValues)[number];
export type NoteExtractionStatus = (typeof noteExtractionStatusEnum.enumValues)[number];
export type NoteTrackLink = typeof noteTrackLinks.$inferSelect;
export type NewNoteTrackLink = typeof noteTrackLinks.$inferInsert;
