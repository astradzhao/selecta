import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Note lifecycle while NL extract → preview → graph commit.
 * Notes are free-form NL; song/transition links come from extraction, not FKs.
 */
export const noteStatusEnum = pgEnum("note_status", ["draft", "preview", "committed"]);

/**
 * Single-user MVP Postgres surface.
 *
 * Songs / artists / genres / transitions live in Neo4j (one shared graph = the library).
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
 * Manual associations between a Postgres note and Neo4j Song ids.
 * No cross-database FK — `songId` is an opaque Neo4j Song.id string.
 * Parsed extraction mentions must not write here without explicit user confirmation.
 */
export const noteSongLinks = pgTable(
  "note_song_links",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    /** Neo4j `Song.id` (string). Not a Postgres FK. */
    songId: text("song_id").notNull(),
    /** Optional free-form role (e.g. from / to / mentioned). */
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("note_song_links_note_id_song_id_uidx").on(table.noteId, table.songId)],
);

export const notesRelations = relations(notes, ({ many }) => ({
  songLinks: many(noteSongLinks),
}));

export const noteSongLinksRelations = relations(noteSongLinks, ({ one }) => ({
  note: one(notes, {
    fields: [noteSongLinks.noteId],
    references: [notes.id],
  }),
}));

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type NoteStatus = (typeof noteStatusEnum.enumValues)[number];
export type NoteSongLink = typeof noteSongLinks.$inferSelect;
export type NewNoteSongLink = typeof noteSongLinks.$inferInsert;
